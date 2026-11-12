/**
 * Our API (Next route handlers under /api, same origin): small fetch helpers for the pages. Pages call routes by
 * URL. A route that hasn't landed yet answers with Next's HTML 404, and that surfaces as NotConnectedError, which
 * pages show as "Not connected yet" (never as sample data).
 */

export class NotConnectedError extends Error {
  constructor(readonly path: string) {
    super(`${path} is not connected yet`);
  }
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const SERVER_DOWN = "The Likeness server isn't answering right now. Try again in a moment.";

/** GET (no body) or POST JSON to our API. Throws NotConnectedError for a route that doesn't exist yet. */
export async function api<T>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res =
      body === undefined
        ? await fetch(path, { cache: "no-store", ...init })
        : await fetch(path, { cache: "no-store", ...init, method: "POST", headers: { "content-type": "application/json", ...init.headers }, body: JSON.stringify(body) });
  } catch {
    throw new Error(SERVER_DOWN);
  }
  const json = (res.headers.get("content-type") ?? "").includes("application/json");
  if ((res.status === 404 || res.status === 501) && !json) throw new NotConnectedError(path);
  const data = json ? await res.json().catch(() => ({})) : {};
  if (!res.ok) throw new ApiRequestError(res.status, (data as { error?: string }).error || (res.status >= 500 ? SERVER_DOWN : `HTTP ${res.status}`));
  return data as T;
}

/** sha256 of a file's bytes, in the browser, as 64 lowercase hex characters (no 0x): the same form as on-chain. */
export async function sha256Hex(file: Blob): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}
