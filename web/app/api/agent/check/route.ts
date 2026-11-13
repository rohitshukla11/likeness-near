/**
 * POST /api/agent/check {sha256}: the safety screen on an ad the agent made (the ad only: no minors, nothing sexualised,
 * no other people; no identity judgement), then (if it passes) its submission on-chain for the creator's review.
 */
import { HEX64, HttpError, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { requireAccount, requireSameOrigin } from "@/lib/session";
import { agentAccountId, agentConfigured } from "@/lib/near/agent";
import { checkAd } from "@/lib/agent/pipeline";

export const maxDuration = 120;

export const POST = route(async (req: Request) => {
  requireSameOrigin(req);
  await rateLimit(req, "ai");
  const brand = await requireAccount();
  if (!agentConfigured() || brand !== agentAccountId()) throw new HttpError(403, "this server's agent acts only for the brand that holds its key");
  const b = await readJson<{ sha256?: unknown }>(req, 2_000);
  if (typeof b.sha256 !== "string" || !HEX64.test(b.sha256)) throw new HttpError(400, "sha256 is required");
  return json(await checkAd(brand, b.sha256));
});
