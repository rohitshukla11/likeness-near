/**
 * Route-handler plumbing: JSON responses, errors with a status, and one wrapper that turns every failure into a plain
 * JSON error (never a stack trace, never a secret). Images are never returned as base64 JSON: see /api/media.
 */
import "server-only";
import { NextResponse } from "next/server";
import { DbNotConfigured } from "./db";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = <T>(data: T, init: ResponseInit = {}) =>
  NextResponse.json(data, { ...init, headers: { "cache-control": "no-store", ...(init.headers ?? {}) } });

/** Wraps a route handler: HttpError → its status; missing DB → 503; anything else → 500 with a generic message. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, { status: e.status });
      if (e instanceof DbNotConfigured) return json({ error: e.message }, { status: 503 });
      console.error("route error:", e instanceof Error ? e.message : e);
      return json({ error: "something went wrong on the server" }, { status: 500 });
    }
  };
}

/** A JSON body, at most `max` bytes (Vercel's limit is 4.5 MB; ours are far smaller). */
export async function readJson<T>(req: Request, max = 1_000_000): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > max) throw new HttpError(413, `request too large (at most ${max} bytes)`);
  const text = await req.text();
  if (text.length > max) throw new HttpError(413, `request too large (at most ${max} bytes)`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "the body isn't valid JSON");
  }
}

/** The client's IP as the platform reports it (x-real-ip, else the first x-forwarded-for entry). */
export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export const HEX64 = /^[0-9a-f]{64}$/;
