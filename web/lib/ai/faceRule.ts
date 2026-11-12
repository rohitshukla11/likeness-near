/**
 * The advisory face check's schema, its strict validation, and the fail-closed rule (decision, 12 Nov). Pure, no imports,
 * unit-tested in test/faceRule.test.ts. It is NOT identity verification and never releases a payment: only the
 * creator's approve_render does.
 */

export const FACE_SYSTEM =
  "You compare faces for an advertising consent workflow. You are not an identity verification system and must not identify anyone. Image A is the creator's consented reference capture; Image B is a generated ad. Compare only visible facial features (face shape, eyes, nose, mouth, hairline, skin tone, distinctive marks). Ignore clothing, lighting, background, pose, expression and art style. Answer only with JSON matching the schema.\nreason: under 25 words.";

export const ISSUES = ["no_face", "multiple_faces", "face_occluded", "low_quality", "appears_minor", "sexualised", "other"] as const;

export const FACE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["faces_in_ad", "same_person", "confidence", "issues", "reason"],
  properties: {
    faces_in_ad: { type: "integer", minimum: 0 },
    same_person: { type: "string", enum: ["yes", "no", "unclear"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    issues: { type: "array", items: { type: "string", enum: [...ISSUES] } },
    reason: { type: "string", maxLength: 200 },
  },
} as const;

export interface FaceAnswer {
  faces_in_ad: number;
  same_person: "yes" | "no" | "unclear";
  confidence: number;
  issues: string[];
  reason: string;
}

/** likely_match / needs_creator_review go on-chain; blocked and mismatch are never submitted; regenerate = try once more. */
export type FaceVerdict = "likely_match" | "needs_creator_review" | "blocked" | "regenerate" | "mismatch";

/** The model's answer, or undefined if it doesn't match the schema exactly (no extra or missing keys). */
export function validateFace(v: unknown): FaceAnswer | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  if (Object.keys(o).sort().join(",") !== "confidence,faces_in_ad,issues,reason,same_person") return undefined;
  if (!Number.isInteger(o.faces_in_ad) || (o.faces_in_ad as number) < 0) return undefined;
  if (!["yes", "no", "unclear"].includes(o.same_person as string)) return undefined;
  if (typeof o.confidence !== "number" || !(o.confidence >= 0 && o.confidence <= 1)) return undefined;
  if (!Array.isArray(o.issues) || !o.issues.every((i) => (ISSUES as readonly string[]).includes(i as string))) return undefined;
  if (typeof o.reason !== "string" || o.reason.length > 200) return undefined;
  return o as unknown as FaceAnswer;
}

/**
 * Fail closed, in this order:
 *   appears_minor or sexualised → blocked;
 *   yes ∧ confidence ≥ 0.8 ∧ exactly one face ∧ no issues → likely_match;
 *   no ∧ confidence ≥ 0.8 → regenerate (first time) / mismatch (after the one regeneration);
 *   anything else, including no answer → needs_creator_review.
 */
export function faceRule(a: FaceAnswer | undefined, alreadyRegenerated: boolean): FaceVerdict {
  if (!a) return "needs_creator_review";
  if (a.issues.includes("appears_minor") || a.issues.includes("sexualised")) return "blocked";
  if (a.same_person === "yes" && a.confidence >= 0.8 && a.faces_in_ad === 1 && a.issues.length === 0) return "likely_match";
  if (a.same_person === "no" && a.confidence >= 0.8) return alreadyRegenerated ? "mismatch" : "regenerate";
  return "needs_creator_review";
}
