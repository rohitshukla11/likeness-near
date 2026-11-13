/**
 * Making an ad under an approved licence, in two separate steps (each its own API call, decision 12 Nov):
 *   makeAd   the campaign's scene and product (written by the agent first if the brand left them empty, lib/agent/scene)
 *            → the fixed prompt (attempt n = renders so far for this licence: never an identical prompt twice) → FLUX.2-klein
 *            edit of the creator's consented front frame → final bytes + sha256 → stored privately. Same sha256 as an
 *            earlier render = already submitted, not a new render.
 *   checkAd  the advisory face check, then: blocked / mismatch (never submitted, nothing reserved), regenerate (once),
 *            or submit_render on-chain with likely_match / needs_creator_review, signed by the agent's function-call key.
 * Nothing here pays anyone: only the creator's approve_render does.
 */
import "server-only";
import { addRender, campaignByLicence, log, renderBySha, renderCount, updateRender } from "../db/records";
import { captureOf, mediaBytes, mediaMeta, putMedia } from "../db/media";
import { HttpError } from "../http";
import { agentCall } from "../near/agent";
import { views } from "../near/view";
import { buildPrompt, VARIATIONS } from "../ai/prompt";
import { editImage } from "../ai/image";
import { faceCheck } from "../ai/faceCheck";
import { finalize } from "../ai/finalize";
import { ensureScene } from "./scene";
import type { FaceCheckDetail } from "../types";

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
  const n = await renderCount(licenceId);
  if (n > VARIATIONS.length) throw new HttpError(409, "every distinct prompt for this campaign is used: start a new campaign with another scene");

  const plan = await ensureScene(brand, campaign);
  const prompt = buildPrompt(plan.scene, plan.product, n);
  const edited = await editImage(brand, await referenceOf(l.creator), prompt);
  const f = await finalize(edited.bytes);
  const existing = await renderBySha(f.sha256);
  if (existing) {
    await log(brand, { kind: "render", summary: `the model returned an image already made for licence ${existing.licence_id}: treated as already submitted, nothing new`, licenceId, sha256: f.sha256 });
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
  await log(brand, { kind: "render", summary: `made ad ${n + 1} for licence ${licenceId}${self(l.creator, brand)} in ${(edited.ms / 1000).toFixed(1)} s; not submitted until the similarity check`, licenceId, sha256: f.sha256 });
  return { sha256: f.sha256, prompt, attempt: n, status: "generated" as const, wrote: plan.wrote ? { scene: plan.scene, product: plan.product } : null };
}

export async function checkAd(brand: string, sha256: string) {
  const row = await renderBySha(sha256);
  if (!row || row.brand !== brand) throw new HttpError(404, "no such ad for this brand");
  if (row.status !== "generated") throw new HttpError(409, `this ad is already ${row.status}`);
  const [ref, ad, meta] = await Promise.all([referenceOf(row.creator), mediaBytes(sha256), mediaMeta(sha256)]);
  if (!ad || !meta) throw new HttpError(409, "the ad's file is missing");

  const fc = await faceCheck(brand, ref, ad, meta.mime, !!row.retry_of);
  const reason = fc.answer?.reason ?? fc.error;
  const detail: FaceCheckDetail = {
    verdict: fc.verdict === "likely_match" ? "likely_match" : "needs_creator_review",
    reason,
    ...(fc.answer ? { samePerson: fc.answer.same_person, confidence: fc.answer.confidence } : {}),
  };
  const raw = { ...detail, outcome: fc.verdict, answer: fc.answer, error: fc.error, ms: fc.ms };

  if (fc.verdict === "blocked" || fc.verdict === "mismatch" || fc.verdict === "regenerate") {
    await updateRender(sha256, { status: fc.verdict, face_check: raw });
    const what = { blocked: "blocked (minors or sexualised content): never submitted, nothing reserved", mismatch: "a different person, twice: never submitted, nothing reserved", regenerate: "a different person: regenerating once with the next prompt" }[fc.verdict];
    await log(brand, { kind: fc.verdict === "regenerate" ? "check" : "blocked", summary: `AI similarity check (advisory) on ${sha256.slice(0, 12)}…: ${what}${reason ? ` (${reason})` : ""}`, licenceId: row.licence_id, sha256 });
    return { status: fc.verdict, faceCheck: detail };
  }

  await updateRender(sha256, { status: "generated", face_check: raw });
  try {
    const r = await agentCall("submit_render", { licence_id: row.licence_id, sha256, face_check: detail.verdict });
    await updateRender(sha256, { status: "submitted", submit_tx: r.hash });
    await log(brand, {
      kind: "submit",
      summary: `submitted the ad for the creator's approval${self(row.creator, brand)}; AI similarity check (advisory): ${detail.verdict === "likely_match" ? "likely the same person" : "needs the creator's review"}; the price is reserved, not paid`,
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
