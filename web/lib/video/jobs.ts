/**
 * Video jobs (Google Gemini Omni Flash, outside NEAR AI's TEE), as background work the brand's page drives:
 *   startVideo  checks everything first (flag, the creator's opt-in, the start image is an ad the creator APPROVED on
 *               this licence, room left on the licence, the per-video cost cap, today's cap) and refuses with the
 *               reason, calling nothing; then reserves today's slot atomically, starts the interaction (the approved
 *               image as the first frame; the fixed template + the campaign's screened scene and product) and returns.
 *   pollVideo   one short check of the interaction; when the clip is done, ONE poll (the one that moves the job from
 *               running to storing) stores the exact bytes (sha256 over them), records the render and submits it with
 *               submit_render (face_check needs_creator_review: no frames are extracted), signed by the agent's key.
 * A video is a render: it counts toward the licence's cap, the creator watches those exact bytes, and only their
 * approve_render pays. Nothing here can approve or pay.
 */
import "server-only";
import { q } from "../db";
import { putMedia, mediaBytes, mediaMeta } from "../db/media";
import { addRender, allowsVideo, campaignByLicence, log, renderBySha, renderCount, updateRender } from "../db/records";
import { HttpError } from "../http";
import { agentCall } from "../near/agent";
import { views } from "../near/view";
import { ensureScene } from "../agent/scene";
import { estimateUsd, JOB_DEADLINE_MS, VIDEO_ASPECT, VIDEO_LABEL, VIDEO_PROVIDER, VIDEO_RESOLUTION, VIDEO_SECONDS, videoEnabled, videoMaxPerDay, videoModel, videoUsdCap } from "./config";
import { videoRefusal } from "./caps";
import { nextStep, type InteractionLike } from "./jobstate";
import { cancelInteraction, getInteraction, outputBytes, startInteraction, VideoApiError } from "./omni";
import { videoPrompt } from "./prompt";
import { videoStorage } from "./storage";

export type JobStatus = "starting" | "running" | "storing" | "submitted" | "failed" | "refused";

export interface VideoJob {
  id: number;
  status: JobStatus;
  licenceId: string;
  fromSha256: string;
  sha256: string | null;
  submitTx: string | null;
  error: string | null;
  estUsd: number;
  ageMs: number;
}

interface JobRow {
  id: string;
  brand: string;
  licence_id: string;
  creator: string;
  from_sha256: string;
  interaction_id: string | null;
  status: JobStatus;
  prompt: string;
  model: string;
  est_usd: string;
  sha256: string | null;
  submit_tx: string | null;
  error: string | null;
  created_at: string;
}

const toJob = (r: JobRow): VideoJob => ({
  id: Number(r.id),
  status: r.status,
  licenceId: r.licence_id,
  fromSha256: r.from_sha256,
  sha256: r.sha256,
  submitTx: r.submit_tx,
  error: r.error,
  estUsd: Number(r.est_usd),
  ageMs: Date.now() - new Date(r.created_at).getTime(),
});

const COUNTED = "status in ('starting', 'running', 'storing', 'submitted')";
export async function videosToday(): Promise<number> {
  const r = await q<{ n: string }>(`select count(*) as n from video_jobs where ${COUNTED} and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'`);
  return Number(r[0]?.n ?? 0);
}

async function setJob(id: number | string, u: Partial<Pick<JobRow, "status" | "interaction_id" | "sha256" | "submit_tx" | "error">>) {
  await q(
    `update video_jobs set status = coalesce($2, status), interaction_id = coalesce($3, interaction_id), sha256 = coalesce($4, sha256),
       submit_tx = coalesce($5, submit_tx), error = coalesce($6, error), updated_at = now() where id = $1`,
    [id, u.status ?? null, u.interaction_id ?? null, u.sha256 ?? null, u.submit_tx ?? null, u.error ?? null],
  );
}

export async function startVideo(brand: string, licenceId: string, fromSha: string): Promise<VideoJob> {
  // Everything is checked before anything is called or reserved.
  const [l, from, receipt] = await Promise.all([views.getLicence(licenceId), renderBySha(fromSha), views.getReceipt(fromSha)]);
  if (!l || l.brand !== brand) throw new HttpError(404, "no such licence for this brand");
  if (l.status !== "Active") throw new HttpError(409, `the licence is ${l.status}, not Active`);
  const fromMeta = await mediaMeta(fromSha);
  const startApproved = !!from && from.licence_id === licenceId && from.brand === brand && receipt?.status === "Approved" && !!fromMeta && fromMeta.mime !== "video/mp4";
  const est = estimateUsd(VIDEO_SECONDS);
  const refusal = videoRefusal({
    enabled: videoEnabled(),
    creatorAllows: await allowsVideo(l.creator),
    startApproved,
    licenceRoom: l.renderCap - l.rendersUsed - l.rendersReserved,
    estUsd: est,
    capUsd: videoUsdCap(),
    usedToday: await videosToday(),
    maxPerDay: videoMaxPerDay(),
  });
  if (refusal) {
    await log(brand, { kind: "blocked", summary: `video refused before any call: ${refusal}`, licenceId, sha256: fromSha });
    throw new HttpError(409, refusal);
  }

  const campaign = await campaignByLicence(licenceId);
  if (!campaign) throw new HttpError(409, "no campaign for this licence");
  const plan = await ensureScene(brand, campaign);
  const prompt = videoPrompt(plan.scene, plan.product);

  // Today's slot, reserved atomically: two starts can't both take the last one.
  const max = videoMaxPerDay();
  const ins = await q<JobRow>(
    `insert into video_jobs (brand, licence_id, creator, from_sha256, status, prompt, model, est_usd)
       select $1, $2, $3, $4, 'starting', $5, $6, $7
       where (select count(*) from video_jobs where ${COUNTED} and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc') < $8
     returning *`,
    [brand, licenceId, l.creator, fromSha, prompt, videoModel(), est.toFixed(4), max],
  );
  if (!ins[0]) throw new HttpError(429, `today's video cap is reached (${max} per day)`);
  const job = ins[0];

  try {
    const image = await mediaBytes(fromSha);
    if (!image || !fromMeta) throw new VideoApiError("the approved ad's image is missing");
    const it = await startInteraction({ image, mime: fromMeta.mime, prompt });
    await setJob(job.id, { status: "running", interaction_id: it.id });
    await log(brand, {
      kind: "render",
      summary: `started a ${VIDEO_SECONDS} s ${VIDEO_RESOLUTION} video (${VIDEO_PROVIDER}, outside NEAR AI's TEE) from approved ad ${fromSha.slice(0, 12)}…; estimated $${est.toFixed(2)}; not submitted until it's stored`,
      licenceId,
      sha256: fromSha,
    });
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    // Not started: the slot isn't counted, nothing was billed.
    await setJob(job.id, { status: "refused", error: msg });
    await log(brand, { kind: "error", summary: `video not started: ${msg}`, licenceId, sha256: fromSha });
    throw new HttpError(502, `video not started: ${msg}`);
  }
  return toJob({ ...job, status: "running" });
}

export async function pollVideo(brand: string, id: number): Promise<VideoJob> {
  const rows = await q<JobRow>(`select * from video_jobs where id = $1`, [id]);
  const job = rows[0];
  if (!job || job.brand !== brand) throw new HttpError(404, "no such video job for this brand");
  if (job.status !== "running" || !job.interaction_id) return toJob(job);

  // A failed check is just another wait (until the deadline).
  const it: InteractionLike = await getInteraction(job.interaction_id).catch(() => ({}));
  const step = nextStep(it, Date.now() - new Date(job.created_at).getTime(), JOB_DEADLINE_MS);
  if (step.kind === "wait") return toJob(job);
  if (step.kind === "failed") {
    if (step.cancel) await cancelInteraction(job.interaction_id);
    await setJob(id, { status: "failed", error: step.reason });
    await log(brand, { kind: "blocked", summary: `video failed: ${step.reason}; never submitted, nothing reserved`, licenceId: job.licence_id });
    return toJob({ ...job, status: "failed", error: step.reason });
  }

  // Done: exactly one poll moves running → storing and does the rest.
  const won = await q<{ id: string }>(`update video_jobs set status = 'storing', updated_at = now() where id = $1 and status = 'running' returning id`, [id]);
  if (!won[0]) return toJob((await q<JobRow>(`select * from video_jobs where id = $1`, [id]))[0]!);
  try {
    const bytes = await outputBytes(it);
    const storage = videoStorage((b, meta) => putMedia(b, { kind: "ad", creator: meta.creator, brand: meta.brand }));
    const sha = await storage.put(bytes, { creator: job.creator, brand });
    const campaign = await campaignByLicence(job.licence_id);
    await addRender({
      sha256: sha,
      licence_id: job.licence_id,
      brand,
      creator: job.creator,
      campaign_id: campaign ? Number(campaign.id) : null,
      prompt: job.prompt,
      provenance: {
        kind: "video",
        mime: "video/mp4",
        provider: VIDEO_PROVIDER,
        model: job.model,
        interactionId: job.interaction_id,
        seconds: VIDEO_SECONDS,
        resolution: VIDEO_RESOLUTION,
        aspect: VIDEO_ASPECT,
        startFrame: job.from_sha256,
        label: VIDEO_LABEL,
        outsideTee: true,
        estUsd: Number(job.est_usd),
        bytes: bytes.length,
      },
      submit_tx: null,
      status: "generated",
      attempt: await renderCount(job.licence_id),
      retry_of: null,
    });
    const faceCheck = { verdict: "needs_creator_review" as const, reason: "a video: no frames are compared; the creator watches it and decides" };
    await updateRender(sha, { status: "generated", face_check: faceCheck });
    const r = await agentCall("submit_render", { licence_id: job.licence_id, sha256: sha, face_check: "needs_creator_review" });
    await updateRender(sha, { status: "submitted", submit_tx: r.hash });
    await setJob(id, { status: "submitted", sha256: sha, submit_tx: r.hash });
    await log(brand, {
      kind: "submit",
      summary: `submitted the video (${bytes.length} bytes, sha256 ${sha.slice(0, 12)}…) for the creator's review; labelled "${VIDEO_LABEL}"; the price is reserved, not paid`,
      licenceId: job.licence_id,
      sha256: sha,
      tx: r.hash,
    });
    return toJob({ ...job, status: "submitted", sha256: sha, submit_tx: r.hash });
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    await setJob(id, { status: "failed", error: msg });
    await log(brand, { kind: "error", summary: `video stored or submitted failed: ${msg}`, licenceId: job.licence_id });
    throw new HttpError(502, `video failed: ${msg}`);
  }
}

/** The brand's recent video jobs (newest first), for its page. */
export async function videoJobs(brand: string, limit = 20): Promise<VideoJob[]> {
  return (await q<JobRow>(`select * from video_jobs where brand = $1 order by created_at desc limit $2`, [brand, Math.min(limit, 50)])).map(toJob);
}
