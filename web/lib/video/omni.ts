/**
 * Google Gemini Omni Flash on the Gemini API (generativelanguage.googleapis.com, v1beta), over plain fetch, as
 * likeness-paypal does it with the SDK: an Interactions request in the background (image-to-video, the start image as
 * the first frame), then GET it until it's done. Each call here is short; the job runner (./jobs) polls across calls.
 * The key (GEMINI_API_KEY) is sent in the x-goog-api-key header only, never in a URL, a log or an error message.
 */
import "server-only";
import { VIDEO_ASPECT, VIDEO_RESOLUTION, VIDEO_SECONDS, videoFaceModel, videoModel, videoStillModel } from "./config";
import { videoOf, type InteractionLike } from "./jobstate";
import { faceMatchFrom } from "./startframe";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export class VideoApiError extends Error {}

const key = () => {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new VideoApiError("GEMINI_API_KEY is not set");
  return k;
};

async function call<T>(path: string, init: { method: "GET" | "POST"; body?: unknown; timeoutMs: number }): Promise<T> {
  const k = key();
  let r: Response;
  try {
    r = await fetch(`${BASE}${path}`, {
      method: init.method,
      headers: { "x-goog-api-key": k, ...(init.body ? { "content-type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(init.timeoutMs),
    });
  } catch (e) {
    throw new VideoApiError(`the video model didn't answer: ${(e as Error).message}`);
  }
  const text = await r.text();
  if (!r.ok) {
    let msg = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { error?: { status?: string; message?: string } };
      msg = `${j.error?.status ?? ""} ${j.error?.message ?? ""}`.trim();
    } catch {
      // not JSON: keep the start of the body
    }
    throw new VideoApiError(`video model: HTTP ${r.status}: ${msg.split(k).join("<key>").slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

/**
 * The video's start frame (as likeness-paypal makes it): Google's image model (VIDEO_STILL_MODEL, default
 * gemini-nano-banana-2.1) generates a new 16:9 image of the person from the creator's REAL reference photo, sent inline
 * with the still prompt (./prompt stillPrompt). One call, 120 s timeout; a block or an empty answer is a VideoApiError.
 */
export async function generateStill(input: { reference: Uint8Array; referenceMime: string; prompt: string }): Promise<{ bytes: Uint8Array; mime: string; model: string }> {
  const model = videoStillModel();
  const res = await call<{
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string; content?: { parts?: { thought?: boolean; inlineData?: { mimeType?: string; data?: string } }[] } }[];
  }>(`/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    timeoutMs: 120_000,
    body: {
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: input.referenceMime, data: Buffer.from(input.reference).toString("base64") } }, { text: input.prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: VIDEO_ASPECT, imageSize: "1K" } },
    },
  });
  if (res.promptFeedback?.blockReason) throw new VideoApiError(`the image model blocked the start frame: ${res.promptFeedback.blockReason}`);
  const c = res.candidates?.[0];
  const img = c?.content?.parts?.find((p) => p.inlineData?.data && !p.thought)?.inlineData;
  if (!img?.data) throw new VideoApiError(`the image model returned no start frame (${c?.finishReason ?? "no reason"})`);
  return { bytes: new Uint8Array(Buffer.from(img.data, "base64")), mime: img.mimeType || "image/png", model };
}

const FACE_SCHEMA = {
  type: "object",
  properties: {
    people: { type: "integer", description: "How many people are visible in the generated image" },
    sameAsReference: { type: "boolean", description: "Is that person the same person as in the reference photo" },
    reason: { type: "string" },
  },
  required: ["people", "sameAsReference", "reason"],
};

/**
 * likeness-paypal's face match on the start frame (its prompt and schema): one person, the same person as the
 * reference. An INTERNAL check only (never a verdict shown anywhere), and fail closed: a check that can't run or gives
 * no valid answer is not a match (ran: false), so the frame is regenerated once, then the job is dropped.
 */
export function faceMatch(ref: { bytes: Uint8Array; mime: string }, still: { bytes: Uint8Array; mime: string }): Promise<{ ran: boolean; match: boolean }> {
  return faceMatchFrom(async () => {
    const res = await call<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }>(`/models/${encodeURIComponent(videoFaceModel())}:generateContent`, {
      method: "POST",
      timeoutMs: 60_000,
      body: {
        systemInstruction: { parts: [{ text: "You compare faces for a likeness-licensing check. Clothing, setting, pose and lighting may differ; judge the face. Answer in JSON matching the schema." }] },
        contents: [
          {
            role: "user",
            parts: [
              { text: "Reference photo of the licensed creator:" },
              { inlineData: { mimeType: ref.mime, data: Buffer.from(ref.bytes).toString("base64") } },
              { text: "Generated advertising image:" },
              { inlineData: { mimeType: still.mime, data: Buffer.from(still.bytes).toString("base64") } },
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseJsonSchema: FACE_SCHEMA },
      },
    });
    return res.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  });
}

/** Starts an image-to-video interaction in the background; returns its id (to poll) and status. */
export async function startInteraction(input: { image: Uint8Array; mime: string; prompt: string }): Promise<InteractionLike & { model: string }> {
  const model = videoModel();
  const it = await call<InteractionLike>("/interactions", {
    method: "POST",
    timeoutMs: 60_000,
    body: {
      model,
      input: [
        { type: "image", data: Buffer.from(input.image).toString("base64"), mime_type: input.mime },
        { type: "text", text: input.prompt },
      ],
      generation_config: { video_config: { task: "image_to_video" } },
      response_format: { type: "video", duration: `${VIDEO_SECONDS}s`, resolution: VIDEO_RESOLUTION, aspect_ratio: VIDEO_ASPECT },
      background: true,
    },
  });
  if (!it.id) throw new VideoApiError("the video model returned no interaction id to poll");
  return { ...it, model };
}

export const getInteraction = (id: string) => call<InteractionLike>(`/interactions/${encodeURIComponent(id)}`, { method: "GET", timeoutMs: 30_000 });

export const cancelInteraction = (id: string) => call<unknown>(`/interactions/${encodeURIComponent(id)}/cancel`, { method: "POST", timeoutMs: 30_000 }).catch(() => undefined);

/** The finished clip's bytes: inline base64, or a Files URI downloaded with the key (never sent to a browser). */
export async function outputBytes(it: InteractionLike): Promise<Uint8Array> {
  const v = videoOf(it);
  if (v?.data) return new Uint8Array(Buffer.from(v.data, "base64"));
  if (v?.uri) {
    const r = await fetch(v.uri, { headers: { "x-goog-api-key": key() }, signal: AbortSignal.timeout(60_000) });
    if (!r.ok) throw new VideoApiError(`downloading the video failed: HTTP ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  }
  throw new VideoApiError("no video in the model's answer");
}
