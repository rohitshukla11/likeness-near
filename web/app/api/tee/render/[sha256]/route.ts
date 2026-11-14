/**
 * GET /api/tee/render/<sha256>: what the app recorded about where an ad was processed, public (Verify shows it): its
 * kind (image or video) and, for an image, the TEE attestation summaries of the image model and the safety-screen
 * model (booleans, model, time, signing address, report hash). Never the ad, its prompt or anything private. 404 if
 * the app has no record of that file.
 */
import { HEX64, HttpError, json, route } from "@/lib/http";
import { renderBySha } from "@/lib/db/records";
import { rateLimit } from "@/lib/ratelimit";
import { renderTee } from "@/lib/renders";
import { teeEnabled } from "@/lib/tee/verify";

export const GET = route(async (req: Request, ctx: { params: Promise<{ sha256: string }> }) => {
  await rateLimit(req, "read");
  const sha = (await ctx.params).sha256.toLowerCase();
  if (!HEX64.test(sha)) throw new HttpError(400, "a sha256 is 64 hex characters");
  const row = await renderBySha(sha);
  if (!row) throw new HttpError(404, "no record of this file");
  const video = row.provenance?.mime === "video/mp4";
  const tee = renderTee(row);
  // Nothing TEE-related for an ad made without attestation (switched off, or made before it existed), and no video line
  // while attestation is switched off.
  if (video ? !teeEnabled() : !tee.image && !tee.screen) throw new HttpError(404, "no TEE record for this file");
  return json({ kind: video ? "video" : "image", image: video ? null : tee.image, screen: video ? null : tee.screen });
});
