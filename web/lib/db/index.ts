/**
 * The Neon client (serverless HTTP driver; no pooled connections to keep warm). DATABASE_URL lives only in
 * web/.env.local and the host's env; it's never logged. Without it every DB call throws DbNotConfigured, which the
 * API turns into a 503 with a plain message.
 */
import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export class DbNotConfigured extends Error {
  constructor() {
    super("the database isn't configured (DATABASE_URL)");
  }
}

let client: NeonQueryFunction<false, false> | null = null;

export function db(): NeonQueryFunction<false, false> {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new DbNotConfigured();
  client = neon(url);
  return client;
}

export const dbConfigured = () => !!process.env.DATABASE_URL;

export type Row = Record<string, unknown>;

/** A parameterised query ($1, $2, …). */
export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await db().query(text, params)) as T[];
}

/** bytes ⇄ base64 for bytea columns (encode/decode in SQL; nothing binary goes through JSON). */
export const toB64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
export const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
