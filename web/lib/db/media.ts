/**
 * Images and video ads, content-addressed by the sha256 of their exact bytes (the same hash the contract records).
 * Captures are private to their creator; ads (images or MP4 videos) are private to their creator and brand until the
 * contract says Licensed.
 */
import "server-only";
import { createHash } from "node:crypto";
import { fromB64, q, toB64 } from "./index";

export const MAX_FRAME_BYTES = 600_000;
export const MAX_AD_BYTES = 3_000_000;
export const MAX_VIDEO_AD_BYTES = 8_000_000;
export type Mime = "image/jpeg" | "image/png" | "image/webp" | "video/mp4";

export interface MediaRow {
  sha256: string;
  mime: Mime;
  size: number;
  kind: "capture" | "ad";
  creator: string;
  brand: string | null;
  public: boolean;
}

export const sha256Hex = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** The type from its first bytes (JPEG, PNG, WebP, or an MP4's "ftyp" box), or null (no SVG, nothing else). */
export function sniffMime(b: Uint8Array): Mime | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length > 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return "video/mp4";
  return null;
}

/** Stores bytes under their sha256 (idempotent: the same bytes are stored once). Returns the sha256. */
export async function putMedia(bytes: Uint8Array, m: { kind: "capture" | "ad"; creator: string; brand?: string | null }): Promise<string> {
  const mime = sniffMime(bytes);
  if (!mime || (mime === "video/mp4" && m.kind !== "ad")) throw new Error("not a JPEG, PNG or WebP image (or an MP4 video ad)");
  const max = m.kind === "capture" ? MAX_FRAME_BYTES : mime === "video/mp4" ? MAX_VIDEO_AD_BYTES : MAX_AD_BYTES;
  if (bytes.length > max) throw new Error(`file too large (${bytes.length} bytes; at most ${max})`);
  const sha = sha256Hex(bytes);
  await q(
    `insert into media (sha256, mime, bytes, size, kind, creator, brand)
     values ($1, $2, decode($3, 'base64'), $4, $5, $6, $7) on conflict (sha256) do nothing`,
    [sha, mime, toB64(bytes), bytes.length, m.kind, m.creator, m.brand ?? null],
  );
  return sha;
}

export async function mediaMeta(sha: string): Promise<MediaRow | null> {
  const r = await q<MediaRow & { size: number }>(`select sha256, mime, size, kind, creator, brand, public from media where sha256 = $1`, [sha]);
  return r[0] ?? null;
}

export async function mediaBytes(sha: string): Promise<Uint8Array | null> {
  const r = await q<{ b: string }>(`select encode(bytes, 'base64') as b from media where sha256 = $1`, [sha]);
  return r[0] ? fromB64(r[0].b) : null;
}

/** An ad the contract verified as Licensed may be served publicly (and cached forever: its bytes never change). */
export async function markPublic(sha: string) {
  await q(`update media set public = true where sha256 = $1 and kind = 'ad'`, [sha]);
}

export interface CaptureRow {
  creator: string;
  front_sha256: string;
  left_sha256: string;
  right_sha256: string;
  consent_at: string;
}

export async function captureOf(creator: string): Promise<CaptureRow | null> {
  const r = await q<CaptureRow>(`select creator, front_sha256, left_sha256, right_sha256, consent_at from captures where creator = $1`, [creator]);
  return r[0] ?? null;
}
