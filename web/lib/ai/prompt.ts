/**
 * The only prompt shape ever sent to the image model (decision, 12 Nov): a fixed template where the agent supplies just
 * {scene} and {product}, each ≤ 200 characters and screened for banned uses before they get here. Seeds are ignored by
 * the edits endpoint, so a retry appends one phrase from a fixed list: an identical prompt is never sent twice.
 * Pure functions (no I/O): unit-tested in test/prompt.test.ts.
 */
/** Same value as rules.FIELD_MAX (this module has no imports so `node --test` can load it directly). */
export const FIELD_MAX = 200;

export const TEMPLATE =
  "Head-and-shoulders or waist-up advertisement photo, front-facing, face large in frame. Keep the person's face, facial features, identity, age and hairstyle exactly unchanged. Scene: {scene}. Product: {product}. No other people. No text or logos.";

export const VARIATIONS = ["slightly different camera angle", "warmer lighting", "different background colour"] as const;

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

/**
 * The prompt for attempt `n` (0 = first). Attempts 1..3 each add a different variation; there is no attempt 4.
 * Throws if scene or product is empty after cleaning.
 */
export function buildPrompt(scene: string, product: string, n = 0): string {
  const s = clean(scene);
  const p = clean(product);
  if (!s || !p) throw new Error("scene and product are required");
  if (!Number.isInteger(n) || n < 0 || n > VARIATIONS.length) throw new Error(`no attempt ${n}: at most ${VARIATIONS.length} retries`);
  const base = TEMPLATE.replace("{scene}", s).replace("{product}", p);
  return n === 0 ? base : `${base} Variation: ${VARIATIONS[n - 1]}.`;
}
