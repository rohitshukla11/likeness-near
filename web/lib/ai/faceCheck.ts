/**
 * The safety screen (lib/ai/faceRule.ts): Qwen3.8-27B on NEAR AI looks at the generated AD ONLY (never the creator's
 * reference) and reports how many faces are visible and whether anyone appears to be a minor or the image is
 * sexualised. Strict JSON, reasoning off, 45 s timeout. A timeout, API error or off-schema answer → "unchecked" (the
 * ad still goes to the creator, who sees every ad). It identifies no one and never releases a payment.
 */
import "server-only";
import { chatJson } from "./nearai";
import { SAFETY_SCHEMA, SAFETY_SYSTEM, safetyRule, validateSafety, type SafetyAnswer, type SafetyVerdict } from "./faceRule";

export interface SafetyRun {
  verdict: SafetyVerdict;
  answer: SafetyAnswer | null;
  error: string | null;
  ms: number | null;
}

const dataUri = (b: Uint8Array, mime: string) => `data:${mime};base64,${Buffer.from(b).toString("base64")}`;

export async function safetyCheck(brand: string, ad: Uint8Array, adMime: string, alreadyRegenerated: boolean): Promise<SafetyRun> {
  try {
    const { json, ms } = await chatJson({
      brand,
      what: "faceCheck",
      schemaName: "safety_screen",
      schema: SAFETY_SCHEMA,
      maxTokens: 200,
      timeoutMs: 45_000,
      messages: [
        { role: "system", content: SAFETY_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "The generated advertising image:" },
            { type: "image_url", image_url: { url: dataUri(ad, adMime) } },
          ],
        },
      ],
    });
    const answer = validateSafety(json) ?? null;
    return { verdict: safetyRule(answer ?? undefined, alreadyRegenerated), answer, error: answer ? null : "the answer didn't match the schema", ms };
  } catch (e) {
    // A cost-cap refusal (429) must surface as such.
    if ((e as { status?: number }).status === 429) throw e;
    return { verdict: "unchecked", answer: null, error: (e as Error).message.slice(0, 200), ms: null };
  }
}
