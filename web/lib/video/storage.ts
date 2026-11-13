/**
 * Where video bytes live: VIDEO_STORAGE=local (default) stores them in Neon like images, served by /api/media/<sha256>
 * with the same privacy rule (only the creator and the brand can fetch them until the contract says Licensed);
 * VIDEO_STORAGE=blob is a stub that throws until we deploy. The sha256 is always over the exact stored bytes, and it's
 * what submit_render records. The database write is injected, so the driver has no server-only imports.
 */
import { createHash } from "node:crypto";
import { MAX_VIDEO_BYTES, videoStorageKind } from "./config.ts";

export interface VideoMeta {
  creator: string;
  brand: string;
}

export interface VideoStorage {
  kind: "local" | "blob";
  /** Stores the bytes; returns the sha256 of exactly those bytes. */
  put(bytes: Uint8Array, meta: VideoMeta): Promise<string>;
  /** Where the browser fetches them (same-origin, privacy-checked). */
  urlFor(sha256: string): string;
}

export const sha256Hex = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** An MP4 starts with a box whose type is "ftyp" (bytes 4–7). */
export const isMp4 = (b: Uint8Array) => b.length > 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;

/** `put` is the database write (lib/db/media putMedia); it must store these exact bytes under their sha256. */
export function localVideoStorage(put: (bytes: Uint8Array, meta: VideoMeta) => Promise<string>): VideoStorage {
  return {
    kind: "local",
    async put(bytes, meta) {
      if (!isMp4(bytes)) throw new Error("the model's answer isn't an MP4 video");
      if (bytes.length > MAX_VIDEO_BYTES) throw new Error(`video too large (${bytes.length} bytes; at most ${MAX_VIDEO_BYTES})`);
      const sha = sha256Hex(bytes);
      const stored = await put(bytes, meta);
      if (stored !== sha) throw new Error("the stored bytes don't hash to the video's sha256");
      return sha;
    },
    urlFor: (sha256) => `/api/media/${sha256}`,
  };
}

export function blobStorage(): VideoStorage {
  const no = () => {
    throw new Error("video storage 'blob' is not configured (local testing uses VIDEO_STORAGE=local)");
  };
  return { kind: "blob", put: async () => no(), urlFor: () => no() };
}

export function videoStorage(put: (bytes: Uint8Array, meta: VideoMeta) => Promise<string>, kind = videoStorageKind()): VideoStorage {
  return kind === "blob" ? blobStorage() : localVideoStorage(put);
}
