/**
 * Per-IP rate limits in Neon (serverless instances share no memory): a fixed one-minute window per key, counted
 * atomically. Over the limit → 429.
 */
import "server-only";
import { q } from "./db";
import { clientIp, HttpError } from "./http";

export const LIMITS = { read: 300, action: 30, ai: 6 } as const;

export async function rateLimit(req: Request, kind: keyof typeof LIMITS, extraKey = "") {
  const window = Math.floor(Date.now() / 60_000);
  const key = `${kind}:${clientIp(req)}${extraKey ? `:${extraKey}` : ""}`;
  const r = await q<{ n: number }>(
    `insert into rate_limits (key, window_start, n) values ($1, $2, 1)
     on conflict (key, window_start) do update set n = rate_limits.n + 1 returning n`,
    [key, window],
  );
  // Old windows are cleaned up now and then (about 1 call in 50).
  if (Math.random() < 0.02) await q(`delete from rate_limits where window_start < $1`, [window - 5]);
  if ((r[0]?.n ?? 0) > LIMITS[kind]) throw new HttpError(429, "too many requests: try again in a minute");
}
