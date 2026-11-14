/**
 * The only prompt shape ever sent to the image model (decision, 12 Nov): a fixed template where the agent supplies just
 * {scene} and {product}, each ≤ 200 characters and screened for banned uses before they get here. The edits endpoint is
 * deterministic (seeds are ignored: the same photo and prompt give the same bytes), so render k of a creator (counted
 * across ALL their licences, from the same reference) appends variation k: a creator's prompt is never repeated, so
 * neither is an ad.
 * Pure functions (no I/O): unit-tested in test/prompt.test.ts.
 */
/** Same value as rules.FIELD_MAX (this module has no imports so `node --test` can load it directly). */
export const FIELD_MAX = 200;

/**
 * The framing sentence, a fixed lookup by the licence's category (no agent choice, no user input): Fitness ads show the
 * person running, full body; every other category keeps the head-and-shoulders / waist-up portrait.
 */
export const FRAMING_RUNNING = "Full-body advertisement photo of the person running mid-stride toward the camera, front-facing, face clearly visible.";
export const FRAMING_PORTRAIT = "Head-and-shoulders or waist-up advertisement photo, front-facing, face large in frame.";
export const framingFor = (use: string): string => (use === "Fitness" ? FRAMING_RUNNING : FRAMING_PORTRAIT);

export const TEMPLATE =
  "{framing} Keep the person's face, facial features, identity, age and hairstyle exactly unchanged. Scene: {scene}. Product: {product}. No other people. No text or logos.";

export const VARIATIONS = [
  "slightly different camera angle",
  "warmer lighting",
  "different background colour",
  "slightly closer framing",
  "softer daylight from a window",
  "a different angle of the product",
  "cooler morning light",
  "slightly wider framing",
] as const;

/** One line, no braces, no prompt-breaking punctuation runs; trimmed to the field limit. */
export function clean(s: string): string {
  return s
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[{}<>]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[.;:]+$/, "")
    .slice(0, FIELD_MAX);
}

/** The variation phrase for render k ≥ 1: the list in order, then again with "take 2", "take 3", … (never repeats). */
export function variation(k: number): string {
  const i = (k - 1) % VARIATIONS.length;
  const take = Math.floor((k - 1) / VARIATIONS.length) + 1;
  return take === 1 ? VARIATIONS[i]! : `${VARIATIONS[i]}, take ${take}`;
}

/**
 * The prompt for a creator's render `k` (0 = their first ever). k ≥ 1 adds variation k, so prompts never repeat for
 * the same creator. Throws if scene or product is empty after cleaning.
 */
export function buildPrompt(use: string, scene: string, product: string, k = 0): string {
  const s = clean(scene);
  const p = clean(product);
  if (!s || !p) throw new Error("scene and product are required");
  if (!Number.isInteger(k) || k < 0) throw new Error(`no render ${k}`);
  const base = TEMPLATE.replace("{framing}", framingFor(use)).replace("{scene}", s).replace("{product}", p);
  return k === 0 ? base : `${base} Variation: ${variation(k)}.`;
}
