/**
 * Live-capture frames, compressed in the browser before upload: at most 768 px on the long side, JPEG quality 0.8
 * (~60–120 KB each), so three frames stay far below Vercel's 4.5 MB request limit. The bytes uploaded are the bytes
 * hashed: the front frame's sha256 is what register_creator records on-chain.
 */

export const MAX_SIDE = 768;
export const QUALITY = 0.8;

/** One frame from the camera, scaled down and encoded as a JPEG data URL. */
export function grabFrame(video: HTMLVideoElement, maxSide = MAX_SIDE, quality = QUALITY): string {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(video.videoWidth * scale);
  c.height = Math.round(video.videoHeight * scale);
  c.getContext("2d")!.drawImage(video, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}

/** A data URL's decoded bytes. */
export function dataUrlBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** sha256 of bytes as 64 lowercase hex characters. */
export async function sha256OfBytes(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}
