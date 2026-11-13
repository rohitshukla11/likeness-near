/**
 * GET /api/media/<sha256>: the exact bytes of an image or a video ad, never base64 in JSON. Videos also answer byte
 * ranges (206), which players use to seek; the sha256 is always over the whole stored file.
 * - An ad the contract verifies as Licensed is public, served with `public, max-age=31536000, immutable` (its bytes are
 *   its name, so they can never change).
 * - Everything else (captures, ads still waiting or rejected) is private: only its creator and brand may see it, with
 *   `private, no-store`. Signed out → 401; signed in as someone else → 404 (no hint it exists).
 */
import { HEX64, HttpError, route } from "@/lib/http";
import { markPublic, mediaBytes, mediaMeta } from "@/lib/db/media";
import { rateLimit } from "@/lib/ratelimit";
import { contractConfigured } from "@/lib/near/config";
import { views } from "@/lib/near/view";
import { currentAccount } from "@/lib/session";

export const GET = route(async (req: Request, ctx: { params: Promise<{ sha256: string }> }) => {
  const sha = (await ctx.params).sha256.toLowerCase();
  if (!HEX64.test(sha)) throw new HttpError(400, "a sha256 is 64 hex characters");
  await rateLimit(req, "read");
  const meta = await mediaMeta(sha);
  if (!meta) throw new HttpError(404, "no such file");

  let isPublic = meta.public;
  if (!isPublic && meta.kind === "ad" && contractConfigured()) {
    const v = await views.verify(sha).catch(() => null);
    if (v?.verdict === "Licensed") {
      await markPublic(sha);
      isPublic = true;
    }
  }
  if (!isPublic) {
    const who = await currentAccount();
    if (!who) throw new HttpError(401, "this file is private: sign in as its creator or brand");
    if (who !== meta.creator && who !== meta.brand) throw new HttpError(404, "no such file");
  }

  const bytes = await mediaBytes(sha);
  if (!bytes) throw new HttpError(404, "no such file");
  const headers: Record<string, string> = {
    "content-type": meta.mime,
    "cache-control": isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
    etag: `"${sha}"`,
    "x-content-type-options": "nosniff",
    "accept-ranges": "bytes",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = bytes.length;
    let start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    end = Math.min(end, size - 1);
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
    start = Math.max(0, start);
    const part = bytes.subarray(start, end + 1);
    return new Response(part as BodyInit, { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(part.length) } });
  }
  return new Response(bytes as BodyInit, { headers: { ...headers, "content-length": String(bytes.length) } });
});
