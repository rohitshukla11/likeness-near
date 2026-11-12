/**
 * GET /api/media/<sha256>: the exact bytes of an image, never base64 in JSON.
 * - An ad the contract verifies as Licensed is public, served with `public, max-age=31536000, immutable` (its bytes are
 *   its name, so they can never change).
 * - Everything else (captures, ads still waiting or rejected) is private: only its creator and brand may see it, with
 *   `private, no-store`. Until sign-in lands, private images answer 401.
 */
import { HEX64, HttpError, route } from "@/lib/http";
import { markPublic, mediaBytes, mediaMeta } from "@/lib/db/media";
import { rateLimit } from "@/lib/ratelimit";
import { contractConfigured } from "@/lib/near/config";
import { views } from "@/lib/near/view";

export const GET = route(async (req: Request, ctx: { params: Promise<{ sha256: string }> }) => {
  const sha = (await ctx.params).sha256.toLowerCase();
  if (!HEX64.test(sha)) throw new HttpError(400, "a sha256 is 64 hex characters");
  await rateLimit(req, "read");
  const meta = await mediaMeta(sha);
  if (!meta) throw new HttpError(404, "no such image");

  let isPublic = meta.public;
  if (!isPublic && meta.kind === "ad" && contractConfigured()) {
    const v = await views.verify(sha).catch(() => null);
    if (v?.verdict === "Licensed") {
      await markPublic(sha);
      isPublic = true;
    }
  }
  if (!isPublic) throw new HttpError(401, "this image is private: sign in as its creator or brand");

  const bytes = await mediaBytes(sha);
  if (!bytes) throw new HttpError(404, "no such image");
  return new Response(bytes as BodyInit, {
    headers: {
      "content-type": meta.mime,
      "content-length": String(bytes.length),
      "cache-control": "public, max-age=31536000, immutable",
      etag: `"${sha}"`,
      "x-content-type-options": "nosniff",
    },
  });
});
