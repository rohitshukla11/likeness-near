/**
 * Video settings. Videos are made with Google Gemini Omni Flash on the Gemini API (model VIDEO_MODEL, default
 * gemini-omni-1.2-flash), not on NEAR AI: on by default for every creator (no opt-in). Direct by default: the start frame
 * is made by Google's image model (VIDEO_STILL_MODEL) from the creator's reference photo, as likeness-paypal does, then
 * safety-screened; or a brand animates an ad image the creator already approved. Pure (reads env only).
 *   VIDEO_ENABLED=true      turns video on (also needs GEMINI_API_KEY); off → the image flow is unchanged, video hidden
 *   VIDEO_MODEL             default gemini-omni-1.2-flash
 *   VIDEO_MAX_PER_DAY       default 3 (site-wide, UTC day)
 *   VIDEO_USD_CAP           default 0.50 per video (refused when the estimate is over it)
 *   VIDEO_USD_PER_M_TOKENS  default 17.5 (output video tokens; 5,792 tokens per second at 720p)
 *   VIDEO_STORAGE           local (default: bytes in Neon, served by /api/media) | blob (stub until we deploy)
 */
type Env = Record<string, string | undefined>;

export const VIDEO_PROVIDER = "Google Gemini Omni Flash";
/** Shown over the player and written in the receipt (the clip itself is never re-encoded). */
export const VIDEO_LABEL = "AI-generated video · licensed likeness";
export const VIDEO_SECONDS = 4;
export const VIDEO_RESOLUTION = "720p";
export const VIDEO_ASPECT = "16:9";
export const TOKENS_PER_SECOND_720P = 5792;
export const MAX_VIDEO_BYTES = 8_000_000;
export const POLL_MS = 5_000;
/** A job not finished after this is cancelled and failed (each poll call itself is short). */
export const JOB_DEADLINE_MS = 10 * 60_000;

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export const videoEnabled = (env: Env = process.env) => env.VIDEO_ENABLED === "true" && !!env.GEMINI_API_KEY;
export const videoModel = (env: Env = process.env) => env.VIDEO_MODEL || "gemini-omni-1.2-flash";
/** The start frame's image model (as likeness-paypal): a new image of the person from their reference photo. */
export const videoStillModel = (env: Env = process.env) => env.VIDEO_STILL_MODEL || "gemini-nano-banana-2.1";
/** paypal's face-match model: is the start frame the same person as the reference, and exactly one person? */
export const videoFaceModel = (env: Env = process.env) => env.VIDEO_FACE_MODEL || "gemini-3.5-flash-lite";
/** One start frame at 1K (Gemini API list price, 2026-11); a regeneration costs one more. */
export const STILL_USD = 0.0336;

/** Shown to creators and brands wherever a video is made or reviewed. */
export const VIDEO_DISCLOSURE = "Video: start frame and clip made with Google's models from the creator's reference photo (outside NEAR AI); the creator approves every video. On by default for this demo; a per-creator opt-in is on the roadmap.";
export const videoMaxPerDay = (env: Env = process.env) => Math.floor(num(env.VIDEO_MAX_PER_DAY, 3));
export const videoUsdCap = (env: Env = process.env) => num(env.VIDEO_USD_CAP, 0.5);
export const videoStorageKind = (env: Env = process.env): "local" | "blob" => (env.VIDEO_STORAGE === "blob" ? "blob" : "local");

/** The estimated price of one video: its start frame + the clip (per-token list price). 4 s at 17.5 $/M ≈ $0.44. */
export const estimateUsd = (seconds = VIDEO_SECONDS, env: Env = process.env) => STILL_USD + (seconds * TOKENS_PER_SECOND_720P * num(env.VIDEO_USD_PER_M_TOKENS, 17.5)) / 1e6;
