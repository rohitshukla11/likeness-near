/**
 * Making an ad under an approved licence, in two separate steps (each its own API call, decision 12 Nov):
 *   makeAd   the campaign's scene and product (written by the agent first if the brand left them empty, lib/agent/scene)
 *            → the fixed prompt (variation n = the creator's renders so far, across all licences: the edit is deterministic,
 *            so a repeated prompt would repeat an ad) → FLUX.2-klein edit of the creator's consented front frame → final
 *            bytes + sha256 → stored privately. If the bytes still match an earlier ad, the next variation is tried (at
 *            most COLLISION_TRIES more); only then is it reported as already submitted.
 *   checkAd  the safety screen on the ad alone (no identity judgement: only the creator can confirm it's them), then:
 *            blocked (a minor or sexualised: never submitted), regenerate once if other people are in it, dropped if they
 *            still are, or submit_render on-chain with needs_creator_review, signed by the agent's function-call key.
 * Nothing here pays anyone: only the creator's approve_render does.
 */
import "server-only";
import { addRender, campaignByLicence, log, renderBySha, renderCountForCreator, updateRender } from "../db/records";
import { captureOf, mediaBytes, mediaMeta, putMedia } from "../db/media";
import { HttpError } from "../http";
import { agentCall } from "../near/agent";
import { views } from "../near/view";
import { buildPrompt } from "../ai/prompt";
import { editImage } from "../ai/image";
import { safetyCheck } from "../ai/faceCheck";
import { finalize } from "../ai/finalize";
import { ensureScene } from "./scene";
import type { FaceCheckDetail } from "../types";

/** Extra variations tried when the model returns an ad that already exists (each is one more billed edit). */
const COLLISION_TRIES = 2;

const self = (creator: string, brand: string) => (creator === brand ? " (self-licence for demo)" : "");

async function referenceOf(creator: string): Promise<Uint8Array> {
  const cap = await captureOf(creator);
  if (!cap) throw new HttpError(409, "there's no reference photo for this creator yet, so there's nothing to edit");
  const ref = await mediaBytes(cap.front_sha256);
  if (!ref) throw new HttpError(409, "the creator's reference photo is missing");
  return ref;
}

export async function makeAd(brand: string, licenceId: string, retryOf?: string) {
  const l = await views.getLicence(licenceId);
  if (!l || l.brand !== brand) throw new HttpError(404, "no such licence for this brand");
  if (l.status !== "Active") throw new HttpError(409, `the licence is ${l.status}, not Active`);
  if (l.rendersUsed + l.rendersReserved >= l.renderCap) throw new HttpError(409, "the licence's render cap is reached");
  if (retryOf) {
    const prev = await renderBySha(retryOf);
    if (!prev || prev.licence_id !== licenceId || prev.status !== "regenerate") throw new HttpError(409, "that render isn't waiting for a regeneration");
  }
  const campaign = await campaignByLicence(licenceId);
  if (!campaign) throw new HttpError(409, "no campaign for this licence");
  const plan = await ensureScene(brand, campaign);
  const reference = await referenceOf(l.creator);
  const start = await renderCountForCreator(l.creator);
  let n = start;
  let prompt = buildPrompt(plan.scene, plan.product, n);
  let edited = await editImage(brand, reference, prompt);
  let f = await finalize(edited.bytes);
  let existing = await renderBySha(f.sha256);
  while (existing && n < start + COLLISION_TRIES) {
    await log(brand, { kind: "render", summary: `prompt ${n + 1} gave an image already made for licence ${existing.licence_id}; trying the next variation`, licenceId, sha256: f.sha256 });
    n += 1;
    prompt = buildPrompt(plan.scene, plan.product, n);
    edited = await editImage(brand, reference, prompt);
    f = await finalize(edited.bytes);
    existing = await renderBySha(f.sha256);
  }
  if (existing) {
    await log(brand, { kind: "render", summary: `the model returned an image already made for licence ${existing.licence_id}, ${COLLISION_TRIES + 1} times: nothing new submitted`, licenceId, sha256: f.sha256 });
    return { sha256: f.sha256, prompt, attempt: n, status: "already_submitted" as const, wrote: plan.wrote ? { scene: plan.scene, product: plan.product } : null };
  }
  await putMedia(f.bytes, { kind: "ad", creator: l.creator, brand });
  await addRender({
    sha256: f.sha256,
    licence_id: licenceId,
    brand,
    creator: l.creator,
    campaign_id: Number(campaign.id),
    prompt,
    provenance: { provider: "NEAR AI Cloud", model: edited.model, requestId: edited.requestId, ms: edited.ms, attempt: n, labelled: f.labelled, catalog: "Private TEE (near.ai/models)" },
    submit_tx: null,
    status: "generated",
    attempt: n,
    retry_of: retryOf ?? null,
  });
  await log(brand, { kind: "render", summary: `made ad ${n + 1} for licence ${licenceId}${self(l.creator, brand)} in ${(edited.ms / 1000).toFixed(1)} s; not submitted until the safety screen`, licenceId, sha256: f.sha256 });
  return { sha256: f.sha256, prompt, attempt: n, status: "generated" as const, wrote: plan.wrote ? { scene: plan.scene, product: plan.product } : null };
}

export async function checkAd(brand: string, sha256: string) {
  const row = await renderBySha(sha256);
  if (!row || row.brand !== brand) throw new HttpError(404, "no such ad for this brand");
  if (row.status !== "generated") throw new HttpError(409, `this ad is already ${row.status}`);
  const [ad, meta] = await Promise.all([mediaBytes(sha256), mediaMeta(sha256)]);
  if (!ad || !meta) throw new HttpError(409, "the ad's file is missing");

  const sc = await safetyCheck(brand, ad, meta.mime, !!row.retry_of);
  const reason = sc.answer?.reason ?? sc.error;
  const detail: FaceCheckDetail = {
    verdict: "needs_creator_review",
    safety: "passed",
    ...(sc.answer ? { facesInAd: sc.answer.faces_in_ad } : {}),
    reason,
  };
  const raw = { ...detail, outcome: sc.verdict, answer: sc.answer, error: sc.error, ms: sc.ms };

  if (sc.verdict === "blocked" || sc.verdict === "dropped" || sc.verdict === "regenerate") {
    await updateRender(sha256, { status: sc.verdict, face_check: raw });
    const what = {
      blocked: "blocked (a minor or sexualised content): never submitted, nothing reserved",
      dropped: sc.answer ? "other people in the ad again: dropped, never submitted, nothing reserved" : "the safety screen gave no valid answer, twice: dropped (fail closed), never submitted, nothing reserved",
      regenerate: `${sc.answer?.faces_in_ad ?? "several"} faces in the ad (other people): regenerating once with the next prompt`,
    }[sc.verdict];
    await log(brand, { kind: sc.verdict === "regenerate" ? "check" : "blocked", summary: `safety screen on ${sha256.slice(0, 12)}…: ${what}${reason ? ` (${reason})` : ""}`, licenceId: row.licence_id, sha256 });
    return { status: sc.verdict, faceCheck: detail };
  }

  await updateRender(sha256, { status: "generated", face_check: raw });
  try {
    const r = await agentCall("submit_render", { licence_id: row.licence_id, sha256, face_check: detail.verdict });
    await updateRender(sha256, { status: "submitted", submit_tx: r.hash });
    await log(brand, {
      kind: "submit",
      summary: `submitted the ad for the creator's approval${self(row.creator, brand)}; safety screen passed; only the creator can confirm it's them; the price is reserved, not paid`,
      licenceId: row.licence_id,
      sha256,
      tx: r.hash,
    });
    return { status: "submitted" as const, faceCheck: detail, tx: r.hash };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    await log(brand, { kind: "error", summary: `submit_render failed: ${msg}`, licenceId: row.licence_id, sha256 });
    throw new HttpError(502, `submit_render failed: ${msg}`);
  }
}
