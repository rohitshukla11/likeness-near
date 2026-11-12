/**
 * NEAR AI spike v2 (gitignored, uncommitted). Hard cap $0.08. Reuses spike-out/reference.jpg.
 *   1. two close-up edits of the reference (form field seed=1 / seed=2: NOT read by cloud-api's edits handler,
 *      which only reads image/model/prompt/size/response_format; sent anyway, outputs compared by sha256)
 *   2. negative control: a clearly different synthetic adult (spike-out/other.jpg)
 *   3. three face checks (reference vs other, ad2a, ad2b), reasoning off via chat_template_kwargs.enable_thinking=false
 *      (accepted = the call succeeds AND usage reports 0 reasoning tokens), "reason: under 25 words"
 *
 *   node scripts/near-ai-spike-v2.ts --confirm
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.NEARAI_BASE_URL ?? "https://cloud-api.near.ai/v1";
const IMAGE_MODEL = "black-forest-labs/FLUX.2-klein-4B";
const VISION_MODEL = "Qwen/Qwen3.8-27B";
const OUT = "spike-out";
const PRICE = { image: 0.012, inPerM: 0.04, outPerM: 1.35 };
const CAP = 0.08;
const CHECK_WORST = (3000 * PRICE.inPerM + 2500 * PRICE.outPerM) / 1e6; // reserve per check before calling

const EDIT_PROMPT =
  "Head-and-shoulders portrait advertisement, front-facing, face large in frame. Keep the person's face, facial features, " +
  "identity, age and hairstyle exactly unchanged. Change only the background to a bright studio with a coffee cup on a " +
  "table and add soft studio lighting. No other people.";
const OTHER_PROMPT =
  "A photorealistic head-and-shoulders portrait photograph of a fictional adult who does not exist (not a real or famous " +
  "person): a man in his late fifties of East Asian descent, short grey hair, clean-shaven, neutral expression, looking " +
  "straight at the camera, plain light grey background, soft even studio light. No text, no watermark, no logo.";
const FACE_SYSTEM =
  "You compare faces for an advertising consent workflow. You are not an identity verification system and must not identify " +
  "anyone. Image A is the creator's consented reference capture; Image B is a generated ad. Compare only visible facial " +
  "features (face shape, eyes, nose, mouth, hairline, skin tone, distinctive marks). Ignore clothing, lighting, background, " +
  "pose, expression and art style. Answer only with JSON matching the schema.";
const ISSUES = ["no_face", "multiple_faces", "face_occluded", "low_quality", "appears_minor", "sexualised", "other"] as const;
const SCHEMA = {
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

type Ans = { faces_in_ad: number; same_person: string; confidence: number; issues: string[]; reason: string };
function validate(v: unknown): Ans | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  if (Object.keys(o).sort().join(",") !== "confidence,faces_in_ad,issues,reason,same_person") return undefined;
  if (!Number.isInteger(o.faces_in_ad) || (o.faces_in_ad as number) < 0) return undefined;
  if (!["yes", "no", "unclear"].includes(o.same_person as string)) return undefined;
  if (typeof o.confidence !== "number" || o.confidence < 0 || o.confidence > 1) return undefined;
  if (!Array.isArray(o.issues) || !o.issues.every((i) => (ISSUES as readonly string[]).includes(i as string))) return undefined;
  if (typeof o.reason !== "string" || o.reason.length > 200) return undefined;
  return o as unknown as Ans;
}
function rule(a: Ans | undefined) {
  if (!a) return "needs_creator_review";
  if (a.issues.includes("appears_minor") || a.issues.includes("sexualised")) return "blocked";
  if (a.same_person === "yes" && a.confidence >= 0.8 && a.faces_in_ad === 1 && a.issues.length === 0) return "likely_match";
  if (a.same_person === "no" && a.confidence >= 0.8) return "mismatch_regenerate";
  return "needs_creator_review";
}
function parseJson(text: string): unknown {
  const t = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s < 0 || e <= s) return undefined;
  try { return JSON.parse(t.slice(s, e + 1)); } catch { return undefined; }
}
const mimeOf = (b: Uint8Array) => (b[0] === 0x89 && b[1] === 0x50 ? "image/png" : b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" : "image/webp");
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

let cost = 0;
const reserve = (usd: number) => {
  if (cost + usd > CAP) throw new Error(`would exceed the $${CAP} cap (spent $${cost.toFixed(4)}, next up to $${usd.toFixed(4)})`);
};

async function post(path: string, key: string, body: BodyInit, json: boolean) {
  const t0 = performance.now();
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, ...(json ? { "Content-Type": "application/json" } : {}) },
    body,
    signal: AbortSignal.timeout(240_000),
  });
  return { status: r.status, ms: Math.round(performance.now() - t0), text: await r.text() };
}
const b64 = (text: string) => {
  const d = (JSON.parse(text) as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
  if (!d) throw new Error("no data[0].b64_json");
  return new Uint8Array(Buffer.from(d, "base64"));
};

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.log("dry run: 2 edits + 1 generation ($0.036 list) + 3 checks (≤ $0.0035 each) ≤ $0.047; cap $0.08. Add --confirm.");
    return;
  }
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const key = process.env.NEARAI_API_KEY;
  if (!key) throw new Error("NEARAI_API_KEY is not set");
  const ref = new Uint8Array(readFileSync(join(OUT, "reference.jpg")));
  const report: Record<string, unknown> = { at: new Date().toISOString(), reference: { path: `${OUT}/reference.jpg`, sha256: sha(ref) } };

  // 1) two edits
  for (const [name, seed] of [["ad2a", "1"], ["ad2b", "2"]] as const) {
    reserve(PRICE.image);
    const f = new FormData();
    f.append("image", new Blob([ref], { type: "image/jpeg" }), "reference.jpg");
    f.append("model", IMAGE_MODEL);
    f.append("prompt", EDIT_PROMPT);
    f.append("size", "1024x1024");
    f.append("response_format", "b64_json");
    f.append("seed", seed);
    const r = await post("/images/edits", key, f, false);
    if (r.status !== 200) throw new Error(`edit ${name} ${r.status}: ${r.text.slice(0, 300)}`);
    cost += PRICE.image;
    const img = b64(r.text);
    writeFileSync(join(OUT, `${name}.jpg`), img);
    report[name] = { path: `${OUT}/${name}.jpg`, ms: r.ms, bytes: img.length, mime: mimeOf(img), seedSent: seed, sha256: sha(img) };
    console.log(`edit ${name}: 200 in ${r.ms} ms, ${img.length} B ${mimeOf(img)}`);
  }

  // 2) negative control
  reserve(PRICE.image);
  const g = await post("/images/generations", key, JSON.stringify({ model: IMAGE_MODEL, prompt: OTHER_PROMPT, n: 1, size: "1024x1024", response_format: "b64_json" }), true);
  if (g.status !== 200) throw new Error(`generation ${g.status}: ${g.text.slice(0, 300)}`);
  cost += PRICE.image;
  const other = b64(g.text);
  writeFileSync(join(OUT, "other.jpg"), other);
  report.other = { path: `${OUT}/other.jpg`, ms: g.ms, bytes: other.length, mime: mimeOf(other) };
  console.log(`other: 200 in ${g.ms} ms, ${other.length} B`);

  // 3) three checks, reasoning off
  const uri = (b: Uint8Array) => `data:${mimeOf(b)};base64,${Buffer.from(b).toString("base64")}`;
  const body = (b: Uint8Array, thinkingOff: boolean) =>
    JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      max_tokens: 2500,
      ...(thinkingOff ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      messages: [
        { role: "system", content: `${FACE_SYSTEM}\nreason: under 25 words.` },
        { role: "user", content: [
          { type: "text", text: "Image A (consented reference):" },
          { type: "image_url", image_url: { url: uri(ref) } },
          { type: "text", text: "Image B (generated ad):" },
          { type: "image_url", image_url: { url: uri(b) } },
        ] },
      ],
      response_format: { type: "json_schema", json_schema: { name: "face_check", strict: true, schema: SCHEMA } },
    });
  const checks: Record<string, unknown> = {};
  for (const name of ["other", "ad2a", "ad2b"] as const) {
    const b = new Uint8Array(readFileSync(join(OUT, `${name}.jpg`)));
    reserve(CHECK_WORST);
    let r = await post("/chat/completions", key, body(b, true), true);
    let param = "chat_template_kwargs.enable_thinking=false";
    let paramRejected: string | undefined;
    if (r.status >= 400 && r.status < 500) {
      paramRejected = `${r.status}: ${r.text.slice(0, 200)}`;
      param = "none (rejected; retried without)";
      r = await post("/chat/completions", key, body(b, false), true);
    }
    if (r.status !== 200) throw new Error(`check ${name} ${r.status}: ${r.text.slice(0, 300)}`);
    const j = JSON.parse(r.text) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; reasoning_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } } };
    const u = j.usage ?? {};
    const c = ((u.prompt_tokens ?? 0) * PRICE.inPerM + (u.completion_tokens ?? 0) * PRICE.outPerM) / 1e6;
    cost += c;
    const content = j.choices?.[0]?.message?.content ?? "";
    const ans = validate(parseJson(content));
    const reasoning = u.completion_tokens_details?.reasoning_tokens ?? u.reasoning_tokens ?? null;
    checks[name] = { ms: r.ms, param, paramRejected, reasoningTokens: reasoning, usage: u, costUsd: Number(c.toFixed(5)), valid: !!ans, answer: ans ?? content.slice(0, 300), verdict: rule(ans) };
    console.log(`check reference vs ${name}: ${r.status} in ${r.ms} ms; reasoning tokens ${reasoning}; ${rule(ans)}`);
    console.log(JSON.stringify(ans ?? content.slice(0, 300)));
  }
  report.checks = checks;
  report.costUsd = Number(cost.toFixed(5));
  writeFileSync(join(OUT, "report-v2.json"), JSON.stringify(report, null, 2));
  console.log(`cost ≈ $${cost.toFixed(4)}; report ${OUT}/report-v2.json`);
}

main().catch((e) => {
  console.error(`spike v2 failed: ${(e as Error).message}`);
  process.exit(1);
});
