// Before `next dev` / `next build`: serve MediaPipe from this app, not from a CDN.
// - Copies the SIMD WASM loader and binary from node_modules/@mediapipe/tasks-vision (version-locked by the lockfile)
//   into public/mediapipe/wasm/ (gitignored, regenerated on every build).
// - Checks the committed face model (public/mediapipe/face_landmarker.task) against its pinned sha256; a mismatch
//   fails the build.
// Browsers without WASM SIMD aren't supported (the no-SIMD fallback isn't shipped).
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = join(web, "public/mediapipe/face_landmarker.task");
const MODEL_SHA256 = "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff";
const FILES = ["vision_wasm_internal.js", "vision_wasm_internal.wasm"];

const src = join(web, "node_modules/@mediapipe/tasks-vision/wasm");
const out = join(web, "public/mediapipe/wasm");
mkdirSync(out, { recursive: true });
for (const f of FILES) copyFileSync(join(src, f), join(out, f));

const got = createHash("sha256").update(readFileSync(MODEL)).digest("hex");
if (got !== MODEL_SHA256) {
  console.error(`mediapipe-assets: ${MODEL} sha256 ${got} != pinned ${MODEL_SHA256}`);
  process.exit(1);
}
console.log(`mediapipe-assets: copied ${FILES.join(", ")}; face model sha256 ok`);
