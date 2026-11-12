/** GET /api/renders/<sha256>: one ad for its creator or its brand only (others get 404, never a hint it exists). */
import { HEX64, HttpError, json, route } from "@/lib/http";
import { renderBySha } from "@/lib/db/records";
import { rateLimit } from "@/lib/ratelimit";
import { toRenderItem } from "@/lib/renders";
import { requireAccount } from "@/lib/session";
import type { RenderItem } from "@/lib/types";

export const GET = route(async (req: Request, ctx: { params: Promise<{ sha256: string }> }) => {
  await rateLimit(req, "read");
  const sha = (await ctx.params).sha256.toLowerCase();
  if (!HEX64.test(sha)) throw new HttpError(400, "a sha256 is 64 hex characters");
  const who = await requireAccount();
  const row = await renderBySha(sha);
  if (!row || (row.creator !== who && row.brand !== who)) throw new HttpError(404, "no such ad");
  const item = await toRenderItem(row);
  if (!item) throw new HttpError(404, "this ad isn't on-chain yet");
  return json<RenderItem>(item);
});
