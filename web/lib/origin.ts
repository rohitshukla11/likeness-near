/**
 * Where the app lives, for anything that must not assume localhost. Pure (reads env only).
 *   NEXT_PUBLIC_APP_URL   the public URL, set in production (e.g. https://likeness-near.onrender.com)
 *   RENDER_EXTERNAL_URL   set by Render on its services; used when NEXT_PUBLIC_APP_URL isn't
 * Locally neither is set, and the app is http://localhost:3000.
 */
type Env = Record<string, string | undefined>;

export function appUrl(env: Env = process.env): string {
  return (env.NEXT_PUBLIC_APP_URL || env.RENDER_EXTERNAL_URL || "http://localhost:3000").replace(/\/+$/, "");
}

const hostOf = (u: string | undefined) => {
  try {
    return u ? new URL(u).host : null;
  } catch {
    return null;
  }
};

/**
 * A state-changing request must come from our own pages: its Origin's host equals the request's Host (or the
 * X-Forwarded-Host a proxy sets), or equals the app's configured public URL. No Origin → refused.
 */
export function sameOriginOk(origin: string | null, host: string | null, env: Env = process.env): boolean {
  const o = hostOf(origin ?? undefined);
  if (!o) return false;
  if (host && o === host) return true;
  return [env.NEXT_PUBLIC_APP_URL, env.RENDER_EXTERNAL_URL].map(hostOf).some((h) => h !== null && h === o);
}
