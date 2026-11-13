/**
 * The safety screen (lib/ai/faceRule.ts): Qwen3.8-27B on NEAR AI looks at the generated AD ONLY (never the creator's
 * reference) and reports how many faces are visible and whether anyone appears to be a minor or the image is
 * sexualised. Strict JSON, reasoning off, 45 s timeout. Fail closed: a timeout, API error or off-schema answer is asked
 * once more; still nothing → the ad is dropped (never submitted). It identifies no one and never releases a payment.
 */
import "server-only";
import { chatJson } from "./nearai";
import { SAFETY_SCHEMA, SAFETY_SYSTEM, safetyRule, screenWithRetry, type SafetyAnswer, type SafetyVerdict } from "./faceRule";

export interface SafetyRun {
  verdict: SafetyVerdict;
  answer: SafetyAnswer | null;
  error: string | null;
  ms: number | null;
}

const dataUri = (b: Uint8Array, mime: string) => `data:${mime};base64,${Buffer.from(b).toString("base64")}`;

export async function safetyCheck(brand: string, ad: Uint8Array, adMime: string, alreadyRegenerated: boolean): Promise<SafetyRun> {
  const t0 = Date.now();
  const { answer, error } = await screenWithRetry(
    async () =>
      (
        await chatJson({
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
        })
      ).json,
  );
  return { verdict: safetyRule(answer, alreadyRegenerated), answer: answer ?? null, error, ms: Date.now() - t0 };
}
