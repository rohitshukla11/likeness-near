/**
 * The safety screen on every generated ad (decision, 13 Nov: the identity comparison was removed after a confirmed
 * false positive in the live run; only the creator can confirm it's them). Qwen3.8-27B looks at the AD ONLY, never the
 * creator's reference, and answers: how many people's faces are visible, and whether anyone appears to be a minor or
 * the image is sexualised. Pure, no imports, unit-tested in test/faceRule.test.ts. It never identifies anyone and never
 * releases a payment: only the creator's approve_render does.
 */

export const SAFETY_SYSTEM =
  "You screen AI-generated advertising images for safety. You do not identify anyone and you do not judge who a person is. Look only at this one image and answer: how many people's faces are visible anywhere in it (including the background), whether any person appears to be under 18, and whether the image is sexualised (nudity, sexual poses or content). Answer only with JSON matching the schema.\nreason: under 25 words.";

export const ISSUES = ["no_face", "appears_minor", "sexualised", "other"] as const;

export const SAFETY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["faces_in_ad", "issues", "reason"],
  properties: {
    faces_in_ad: { type: "integer", minimum: 0 },
    issues: { type: "array", items: { type: "string", enum: [...ISSUES] } },
    reason: { type: "string", maxLength: 200 },
  },
} as const;

export interface SafetyAnswer {
  faces_in_ad: number;
  issues: string[];
  reason: string;
}

/**
 * passed     → submitted for the creator's review (on-chain face_check is always needs_creator_review);
 * blocked    → a minor or sexualised content: never submitted, nothing reserved;
 * regenerate → other people in the ad: one more try with the same template and the next variation phrase;
 * dropped    → other people again after that try, OR no valid answer from the screen even after one retry
 *              (fail closed): never submitted, nothing reserved.
 */
export type SafetyVerdict = "passed" | "blocked" | "regenerate" | "dropped";

/** The model's answer, or undefined if it doesn't match the schema exactly (no extra or missing keys). */
export function validateSafety(v: unknown): SafetyAnswer | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  if (Object.keys(o).sort().join(",") !== "faces_in_ad,issues,reason") return undefined;
  if (!Number.isInteger(o.faces_in_ad) || (o.faces_in_ad as number) < 0) return undefined;
  if (!Array.isArray(o.issues) || !o.issues.every((i) => (ISSUES as readonly string[]).includes(i as string))) return undefined;
  if (typeof o.reason !== "string" || o.reason.length > 200) return undefined;
  return o as unknown as SafetyAnswer;
}

/** Asks the screen; on no valid answer (error, timeout, off-schema), asks once more. Undefined after two misses. */
export async function screenWithRetry(ask: () => Promise<unknown>): Promise<{ answer: SafetyAnswer | undefined; attempts: number; error: string | null }> {
  let error: string | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const answer = validateSafety(await ask());
      if (answer) return { answer, attempts: attempt, error: null };
      error = "the answer didn't match the schema";
    } catch (e) {
      // A cost-cap refusal (429) is not "no answer": it must surface as such.
      if ((e as { status?: number }).status === 429) throw e;
      error = (e as Error).message.slice(0, 200);
    }
  }
  return { answer: undefined, attempts: 2, error };
}

/** In this order (fail closed): no valid answer → dropped; minor or sexualised → blocked; more than one face → regenerate once, then dropped. */
export function safetyRule(a: SafetyAnswer | undefined, alreadyRegenerated: boolean): SafetyVerdict {
  if (!a) return "dropped";
  if (a.issues.includes("appears_minor") || a.issues.includes("sexualised")) return "blocked";
  if (a.faces_in_ad > 1) return alreadyRegenerated ? "dropped" : "regenerate";
  return "passed";
}
