/**
 * POST /api/agent/video/<id>: one short check of a video job. When the clip is done, this call stores its exact bytes,
 * records the render and submits it for the creator's review (lib/video/jobs). The page calls it every 5 s.
 */
import { HttpError, json, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { requireAccount, requireSameOrigin } from "@/lib/session";
import { pollVideo } from "@/lib/video/jobs";

export const maxDuration = 120;

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  requireSameOrigin(req);
  await rateLimit(req, "read");
  const brand = await requireAccount();
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, "a job id is a positive integer");
  return json(await pollVideo(brand, id));
});
