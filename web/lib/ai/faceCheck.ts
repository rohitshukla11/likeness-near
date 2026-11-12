/**
 * The advisory "AI similarity check": Qwen3.8-27B compares the creator's consented reference frame (A) with the ad (B),
 * strict JSON, reasoning off, 45 s timeout. Any timeout, API error or off-schema answer → needs_creator_review. It is not
 * identity verification and never releases a payment.
 */
import "server-only";
import { chatJson } from "./nearai";
import { FACE_SCHEMA, FACE_SYSTEM, faceRule, validateFace, type FaceAnswer, type FaceVerdict } from "./faceRule";

export interface FaceCheckRun {
  verdict: FaceVerdict;
  answer: FaceAnswer | null;
  error: string | null;
  ms: number | null;
}

const dataUri = (b: Uint8Array, mime: string) => `data:${mime};base64,${Buffer.from(b).toString("base64")}`;

export async function faceCheck(brand: string, reference: Uint8Array, ad: Uint8Array, adMime: string, alreadyRegenerated: boolean): Promise<FaceCheckRun> {
  try {
    const { json, ms } = await chatJson({
      brand,
      what: "faceCheck",
      schemaName: "face_check",
      schema: FACE_SCHEMA,
      maxTokens: 300,
      timeoutMs: 45_000,
      messages: [
        { role: "system", content: FACE_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Image A (consented reference):" },
            { type: "image_url", image_url: { url: dataUri(reference, "image/jpeg") } },
            { type: "text", text: "Image B (generated ad):" },
            { type: "image_url", image_url: { url: dataUri(ad, adMime) } },
          ],
        },
      ],
    });
    const answer = validateFace(json) ?? null;
    return { verdict: faceRule(answer ?? undefined, alreadyRegenerated), answer, error: answer ? null : "the answer didn't match the schema", ms };
  } catch (e) {
    // A cost-cap refusal (429) must surface as such, not as a review flag.
    if ((e as { status?: number }).status === 429) throw e;
    return { verdict: "needs_creator_review", answer: null, error: (e as Error).message.slice(0, 200), ms: null };
  }
}
