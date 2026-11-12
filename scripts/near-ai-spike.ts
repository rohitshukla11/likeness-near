/**
 * NEAR AI spike (uncommitted until step 10; gitignored until then). Answers, before any commit:
 *   1. /v1/images/generations: a SYNTHETIC reference face (a fictional adult, never a real person)
 *   2. /v1/images/edits: that face as the reference (multipart, one `image` part), FLUX.2-klein-4B
 *   3. one Qwen/Qwen3.8-27B advisory face check (reference vs the edited ad), JSON validated in code
 *
 * Billed: at most 2 images × $0.012 + 1 chat call (~$0.005) ≈ $0.03; hard cap $0.05.
 * Safe by default: without --confirm it prints the dry run (requests and cost) and makes NO network call.
 *
 *   node scripts/near-ai-spike.ts              dry run
 *   node scripts/near-ai-spike.ts --confirm    the real run (needs NEARAI_API_KEY in .env.local)
 *
 * Output: spike-out/ (gitignored): reference.*, ad.*, report.json. The API key is never printed or written.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.NEARAI_BASE_URL ?? "https://cloud-api.near.ai/v1";
const IMAGE_MODEL = "black-forest-labs/FLUX.2-klein-4B";
const VISION_MODEL = "Qwen/Qwen3.8-27B";
const OUT = "spike-out";
const PRICE = { image: 0.012, inPerM: 0.04, outPerM: 1.35 }; // near.ai/models, 12 Nov 2026
const COST_CAP_USD = 0.05;

const REFERENCE_PROMPT =
  "A photorealistic head-and-shoulders portrait photograph of a fictional adult who does not exist (not a real or famous person): " +
  "a woman in her late twenties, friendly neutral expression, looking straight at the camera, plain light grey background, " +
  "soft even studio light. The whole head and hair inside the frame, with space above the head. No text, no watermark, no logo.";
const EDIT_PROMPT =
  "Advertising photo for a running-shoe brand: this exact person, same face and identity, jogging on a city riverside path " +
  "at golden hour, wearing a plain grey athletic top. Keep the face clearly visible and unchanged. No text, no logo.";

const FACE_SYSTEM =
  "You compare faces for an advertising consent workflow. You are not an identity verification system and must not identify " +
  "anyone. Image A is the creator's consented reference capture; Image B is a generated ad. Compare only visible facial " +
  "features (face shape, eyes, nose, mouth, hairline, skin tone, distinctive marks). Ignore clothing, lighting, background, " +
  "pose, expression and art style. Answer only with JSON matching the schema.";
const ISSUES = ["no_face", "multiple_faces", "face_occluded", "low_quality", "appears_minor", "sexualised", "other"] as const;
const FACE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["faces_in_ad", "same_person", "confidence", "issues", "reason"],
  properties: {
    faces_in_ad: { type: "integer", minimum: 0 },
    same_person: { type: "string", enum: ["yes", "no", "unclear"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    issues: { type: "array", items: { type: "string", enum: ISSUES } },
    reason: { type: "string", maxLength: 200 },
  },
};

type FaceAnswer = { faces_in_ad: number; same_person: "yes" | "no" | "unclear"; confidence: number; issues: string[]; reason: string };
type Verdict = "likely_match" | "mismatch_regenerate" | "blocked" | "needs_creator_review";

/** Validates the model's answer in code (never trusts schema compliance). Returns undefined if invalid. */
function validate(v: unknown): FaceAnswer | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort().join(",");
  if (keys !== "confidence,faces_in_ad,issues,reason,same_person") return undefined;
  if (!Number.isInteger(o.faces_in_ad) || (o.faces_in_ad as number) < 0) return undefined;
  if (!["yes", "no", "unclear"].includes(o.same_person as string)) return undefined;
  if (typeof o.confidence !== "number" || o.confidence < 0 || o.confidence > 1) return undefined;
  if (!Array.isArray(o.issues) || !o.issues.every((i) => (ISSUES as readonly string[]).includes(i as string))) return undefined;
  if (typeof o.reason !== "string" || o.reason.length > 200) return undefined;
  return o as unknown as FaceAnswer;
}

/** The fail-closed rule. A single check here, so "no" with high confidence reads as "regenerate once". */
function rule(a: FaceAnswer | undefined): Verdict {
  if (!a) return "needs_creator_review";
  if (a.issues.includes("appears_minor") || a.issues.includes("sexualised")) return "blocked";
  if (a.same_person === "yes" && a.confidence >= 0.8 && a.faces_in_ad === 1 && a.issues.length === 0) return "likely_match";
  if (a.same_person === "no" && a.confidence >= 0.8) return "mismatch_regenerate";
  return "needs_creator_review";
}

/** The model's text → JSON: drops a <think> block, then takes the outermost {...}. */
function parseJson(text: string): unknown {
  const t = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s < 0 || e <= s) return undefined;
  try {
    return JSON.parse(t.slice(s, e + 1));
  } catch {
    return undefined;
  }
}

const mimeOf = (b: Uint8Array) =>
  b[0] === 0x89 && b[1] === 0x50 ? "image/png" : b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" : b[0] === 0x52 && b[8] === 0x57 ? "image/webp" : "application/octet-stream";
const extOf = (m: string) => ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" })[m] ?? "bin";

function dryRun() {
  const est = 2 * PRICE.image + (6000 * PRICE.inPerM + 2500 * PRICE.outPerM) / 1e6;
  console.log(`NEAR AI spike: DRY RUN (no network call). Base ${BASE}

1) POST /images/generations  (JSON)
   { model: "${IMAGE_MODEL}", prompt: <synthetic fictional adult, ${REFERENCE_PROMPT.length} chars>,
     n: 1, size: "1024x1024", response_format: "b64_json" }                       $${PRICE.image.toFixed(3)}
2) POST /images/edits  (multipart/form-data)
   image=<step 1 bytes, one file part named "image">, model="${IMAGE_MODEL}",
   prompt=<running-shoe ad, ${EDIT_PROMPT.length} chars>, size="1024x1024", response_format="b64_json"   $${PRICE.image.toFixed(3)}
3) POST /chat/completions  (JSON)
   { model: "${VISION_MODEL}", temperature: 0, max_tokens: 2500,
     messages: [system: face-check prompt, user: [text "Image A", image_url data:A, text "Image B", image_url data:B]],
     response_format: { type: "json_schema", json_schema: { name: "face_check", strict: true, schema } } }
   (if the server rejects response_format with a 4xx, ONE retry without it; prompt-only JSON, validated in code)
   ~6k input tokens (2 images) + ≤2.5k output (reasoning)                            ~$${((6000 * PRICE.inPerM + 2500 * PRICE.outPerM) / 1e6).toFixed(4)}

Estimated total ≈ $${est.toFixed(3)} (hard cap $${COST_CAP_USD.toFixed(2)}). Output: ${OUT}/ (gitignored).
Run for real with: node scripts/near-ai-spike.ts --confirm`);
}

async function post(path: string, key: string, body: BodyInit, json: boolean) {
  const t0 = performance.now();
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, ...(json ? { "Content-Type": "application/json" } : {}) },
    body,
    signal: AbortSignal.timeout(180_000),
  });
  const ms = Math.round(performance.now() - t0);
  const text = await r.text();
  return { status: r.status, ms, text, requestId: r.headers.get("x-request-id") };
}

function b64image(text: string): Uint8Array {
  const j = JSON.parse(text) as { data?: { b64_json?: string }[] };
  const b = j.data?.[0]?.b64_json;
  if (!b) throw new Error("no data[0].b64_json in the response");
  return new Uint8Array(Buffer.from(b, "base64"));
}

async function run() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const key = process.env.NEARAI_API_KEY;
  if (!key) throw new Error("NEARAI_API_KEY is not set in .env.local");
  mkdirSync(OUT, { recursive: true });
  const report: Record<string, unknown> = { at: new Date().toISOString(), base: BASE };
  let cost = 0;
  const spend = (usd: number) => {
    cost += usd;
    if (cost > COST_CAP_USD) throw new Error(`cost cap reached ($${cost.toFixed(4)})`);
  };

  // 1) synthetic reference face
  spend(PRICE.image);
  const g = await post("/images/generations", key, JSON.stringify({ model: IMAGE_MODEL, prompt: REFERENCE_PROMPT, n: 1, size: "1024x1024", response_format: "b64_json" }), true);
  if (g.status !== 200) throw new Error(`generations ${g.status}: ${g.text.slice(0, 300)}`);
  const ref = b64image(g.text);
  const refMime = mimeOf(ref);
  writeFileSync(join(OUT, `reference.${extOf(refMime)}`), ref);
  report.generation = { status: g.status, ms: g.ms, bytes: ref.length, mime: refMime, requestId: g.requestId };
  console.log(`1) generation: ${g.status} in ${g.ms} ms, ${ref.length} bytes ${refMime}`);

  // 2) edit with the reference
  const form = new FormData();
  form.append("image", new Blob([ref], { type: refMime }), `reference.${extOf(refMime)}`);
  form.append("model", IMAGE_MODEL);
  form.append("prompt", EDIT_PROMPT);
  form.append("size", "1024x1024");
  form.append("response_format", "b64_json");
  spend(PRICE.image);
  const e = await post("/images/edits", key, form, false);
  report.edit = { status: e.status, ms: e.ms, requestId: e.requestId };
  if (e.status !== 200) {
    report.edit = { ...(report.edit as object), error: e.text.slice(0, 500) };
    writeFileSync(join(OUT, "report.json"), JSON.stringify({ ...report, costUsd: cost }, null, 2));
    throw new Error(`edits ${e.status}: ${e.text.slice(0, 300)}`);
  }
  const ad = b64image(e.text);
  const adMime = mimeOf(ad);
  writeFileSync(join(OUT, `ad.${extOf(adMime)}`), ad);
  report.edit = { ...(report.edit as object), bytes: ad.length, mime: adMime, acceptsReference: "multipart field `image` (one file)" };
  console.log(`2) edit: ${e.status} in ${e.ms} ms, ${ad.length} bytes ${adMime}`);

  // 3) advisory face check
  const dataUri = (b: Uint8Array, m: string) => `data:${m};base64,${Buffer.from(b).toString("base64")}`;
  const chat = (withSchema: boolean) =>
    JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      max_tokens: 2500,
      messages: [
        { role: "system", content: FACE_SYSTEM + (withSchema ? "" : `\nSchema: ${JSON.stringify(FACE_SCHEMA)}`) },
        {
          role: "user",
          content: [
            { type: "text", text: "Image A (consented reference):" },
            { type: "image_url", image_url: { url: dataUri(ref, refMime) } },
            { type: "text", text: "Image B (generated ad):" },
            { type: "image_url", image_url: { url: dataUri(ad, adMime) } },
          ],
        },
      ],
      ...(withSchema ? { response_format: { type: "json_schema", json_schema: { name: "face_check", strict: true, schema: FACE_SCHEMA } } } : {}),
    });
  let c = await post("/chat/completions", key, chat(true), true);
  let schemaMode = "json_schema strict";
  if (c.status >= 400 && c.status < 500) {
    report.schemaRejected = { status: c.status, error: c.text.slice(0, 300) };
    schemaMode = "prompt-only (json_schema rejected)";
    c = await post("/chat/completions", key, chat(false), true);
  }
  if (c.status !== 200) throw new Error(`chat ${c.status}: ${c.text.slice(0, 300)}`);
  const cj = JSON.parse(c.text) as { choices?: { message?: { content?: string; reasoning_content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const content = cj.choices?.[0]?.message?.content ?? "";
  const answer = validate(parseJson(content));
  const chatCost = ((cj.usage?.prompt_tokens ?? 0) * PRICE.inPerM + (cj.usage?.completion_tokens ?? 0) * PRICE.outPerM) / 1e6;
  spend(chatCost);
  report.faceCheck = { status: c.status, ms: c.ms, schemaMode, usage: cj.usage, raw: content.slice(0, 1200), valid: !!answer, answer, verdict: rule(answer) };
  console.log(`3) face check: ${c.status} in ${c.ms} ms (${schemaMode}); valid=${!!answer}; verdict=${rule(answer)}`);
  console.log(JSON.stringify(answer ?? content.slice(0, 400), null, 2));

  report.costUsd = Number(cost.toFixed(5));
  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
  console.log(`cost ≈ $${cost.toFixed(4)} (images at list price + chat by usage). Report: ${OUT}/report.json`);
}

if (process.argv.includes("--confirm")) {
  run().catch((err) => {
    console.error(`spike failed: ${(err as Error).message}`);
    process.exit(1);
  });
} else {
  dryRun();
}
