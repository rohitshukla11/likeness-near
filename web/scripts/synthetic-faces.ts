// pnpm faces:synthetic [--confirm]
//   Generates the synthetic demo creators' faces (Maya Lindqvist and Theo Marlowe, lib/synthetic.ts) with NEAR AI Cloud,
//   FLUX.2-klein-4B /images/generations, from a text prompt only (no source photo): fictional adults who don't exist.
//   The prompts are the ones the PayPal demo used for the same two personas. BILLED: 2 images × $0.012 ≈ $0.024, hard
//   cap $0.06. DRY RUN by default (no network call). Output: spike-out/synthetic-faces/ (gitignored) with each image and
//   its provenance (model, request id, prompt, time); copying a face into public/synthetic/ is a separate, reviewed step.
//   The API key is never printed or written.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.NEARAI_BASE_URL ?? "https://cloud-api.near.ai/v1";
const MODEL = "black-forest-labs/FLUX.2-klein-4B";
const PRICE_PER_IMAGE = 0.012; // near.ai/models, 12 Nov 2026
const COST_CAP_USD = 0.06;
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "spike-out", "synthetic-faces");

const NOT_REAL =
  "This is a fictional person who does not exist. The face must be entirely invented and must not resemble any real person, celebrity, public figure or famous person. No text, logos or watermarks.";
const FACES = [
  {
    key: "maya",
    prompt: `A photorealistic head-and-shoulders portrait photo of a fictional adult woman in her late twenties, a fitness coach: athletic, friendly smile, light brown hair in a ponytail, a plain teal sports top, soft daylight, neutral light background, looking at the camera, sharp focus on the face. ${NOT_REAL}`,
  },
  {
    key: "theo",
    prompt: `A photorealistic head-and-shoulders portrait photo of a fictional adult man in his mid thirties, a tech reviewer: short dark hair, a trimmed beard, round glasses, a plain charcoal t-shirt, soft studio light, neutral warm background, looking at the camera, sharp focus on the face. ${NOT_REAL}`,
  },
];

const mimeOf = (b: Uint8Array) => (b[0] === 0x89 && b[1] === 0x50 ? "image/png" : b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" : b[0] === 0x52 && b[8] === 0x57 ? "image/webp" : "application/octet-stream");
const extOf = (m: string) => ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" })[m] ?? "bin";

if (!process.argv.includes("--confirm")) {
  console.log(`DRY RUN (no network call): ${FACES.length} synthetic faces with NEAR AI Cloud\n`);
  for (const f of FACES) {
    console.log(`POST ${BASE}/images/generations`);
    console.log(`  { model: "${MODEL}", n: 1, size: "1024x1024", response_format: "b64_json",`);
    console.log(`    prompt: "${f.prompt}" }`);
    console.log(`  → spike-out/synthetic-faces/${f.key}.<ext> + ${f.key}.json   $${PRICE_PER_IMAGE.toFixed(3)}\n`);
  }
  console.log(`Estimated total $${(FACES.length * PRICE_PER_IMAGE).toFixed(3)} (hard cap $${COST_CAP_USD.toFixed(2)}). Run for real with --confirm.`);
  process.exit(0);
}

const key = process.env.NEARAI_API_KEY;
if (!key) throw new Error("NEARAI_API_KEY is not set in .env.local");
mkdirSync(OUT, { recursive: true });
let cost = 0;
for (const f of FACES) {
  if (cost + PRICE_PER_IMAGE > COST_CAP_USD) throw new Error(`cost cap reached ($${cost.toFixed(3)})`);
  const t0 = performance.now();
  const r = await fetch(`${BASE}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, prompt: f.prompt, n: 1, size: "1024x1024", response_format: "b64_json" }),
    signal: AbortSignal.timeout(180_000),
  });
  cost += PRICE_PER_IMAGE;
  const ms = Math.round(performance.now() - t0);
  const text = await r.text();
  if (r.status !== 200) throw new Error(`${f.key}: HTTP ${r.status}: ${text.slice(0, 300)}`);
  const b64 = (JSON.parse(text) as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
  if (!b64) throw new Error(`${f.key}: no data[0].b64_json in the response`);
  const bytes = new Uint8Array(Buffer.from(b64, "base64"));
  const mime = mimeOf(bytes);
  const file = join(OUT, `${f.key}.${extOf(mime)}`);
  if (existsSync(file)) throw new Error(`${file} exists: move it away first (never overwrite a reviewed face)`);
  writeFileSync(file, bytes);
  const meta = { provider: "NEAR AI Cloud", endpoint: "/images/generations", model: MODEL, requestId: r.headers.get("x-request-id"), at: new Date().toISOString(), ms, mime, bytes: bytes.length, prompt: f.prompt };
  writeFileSync(join(OUT, `${f.key}.json`), JSON.stringify(meta, null, 2) + "\n");
  console.log(`${f.key}: ${mime}, ${bytes.length} B, ${ms} ms, request ${meta.requestId} → ${file}`);
}
console.log(`Spent ≈ $${cost.toFixed(3)}.`);
