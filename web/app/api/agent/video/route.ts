/**
 * Video ads (Google Gemini Omni Flash on the Gemini API, outside NEAR AI's TEE; lib/video).
 *   GET  → whether video is on, today's count and cap, the estimate per clip, and the brand's recent jobs.
 *   POST {licenceId, fromSha256} → starts a background job from an ad image the creator approved; returns the job.
 * Only the brand whose function-call key this server holds can start one; each call is short (the page polls).
 */
import { HEX64, HttpError, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { requireAccount, requireSameOrigin } from "@/lib/session";
import { agentAccountId, agentConfigured } from "@/lib/near/agent";
import { estimateUsd, VIDEO_SECONDS, videoEnabled, videoMaxPerDay, videoUsdCap } from "@/lib/video/config";
import { startVideo, videoJobs, videosToday } from "@/lib/video/jobs";

export const maxDuration = 60;

export const GET = route(async () => {
  const brand = await requireAccount();
  const enabled = videoEnabled();
  return json({
    enabled,
    seconds: VIDEO_SECONDS,
    estUsd: estimateUsd(VIDEO_SECONDS),
    capUsd: videoUsdCap(),
    maxPerDay: videoMaxPerDay(),
    usedToday: enabled ? await videosToday() : 0,
    jobs: enabled ? await videoJobs(brand) : [],
  });
});

export const POST = route(async (req: Request) => {
  requireSameOrigin(req);
  await rateLimit(req, "ai");
  const brand = await requireAccount();
  if (!agentConfigured() || brand !== agentAccountId()) throw new HttpError(403, "this server's agent acts only for the brand that holds its key");
  const b = await readJson<{ licenceId?: unknown; fromSha256?: unknown }>(req, 2_000);
  if (typeof b.licenceId !== "string" || !/^\d{1,19}$/.test(b.licenceId)) throw new HttpError(400, "licenceId is required");
  if (typeof b.fromSha256 !== "string" || !HEX64.test(b.fromSha256)) throw new HttpError(400, "fromSha256 (the approved ad) is required");
  return json(await startVideo(brand, b.licenceId, b.fromSha256.toLowerCase()));
});
