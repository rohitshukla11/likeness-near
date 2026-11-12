/**
 * Image edits on NEAR AI Cloud: FLUX.2-klein-4B, `/images/edits` with the creator's consented front frame as the single
 * `image` part (multipart), b64_json out. Seeds are ignored by the endpoint, so variety comes only from the prompt.
 * Each call reserves $0.012 under the cost cap first. AI_MODE=test refuses (no fake images).
 */
import "server-only";
import { reserveAi } from "../costcap";
import { AiError, aiEnabled, BASE, IMAGE_MODEL } from "./nearai";

export interface Edited {
  bytes: Uint8Array;
  ms: number;
  requestId: string | null;
  model: string;
}

export async function editImage(brand: string, reference: Uint8Array, prompt: string): Promise<Edited> {
  if (!aiEnabled()) throw new AiError("image generation is off (AI_MODE=test or no NEARAI_API_KEY): no image was made");
  await reserveAi(brand, "image");
  const form = new FormData();
  form.append("image", new Blob([reference as BlobPart], { type: "image/jpeg" }), "reference.jpg");
  form.append("model", IMAGE_MODEL);
  form.append("prompt", prompt);
  form.append("size", "1024x1024");
  form.append("response_format", "b64_json");
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${BASE}/images/edits`, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.NEARAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(90_000),
    });
  } catch (e) {
    throw new AiError(`the image model didn't answer in time (${(e as Error).name})`);
  }
  const ms = Date.now() - t0;
  if (!res.ok) throw new AiError(`the image model answered HTTP ${res.status}`);
  const j = (await res.json()) as { data?: { b64_json?: string }[] };
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new AiError("the image model returned no image");
  return { bytes: new Uint8Array(Buffer.from(b64, "base64")), ms, requestId: res.headers.get("x-request-id"), model: IMAGE_MODEL };
}
