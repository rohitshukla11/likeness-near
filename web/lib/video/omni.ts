/**
 * Google Gemini Omni Flash on the Gemini API (generativelanguage.googleapis.com, v1beta), over plain fetch, as
 * likeness-paypal does it with the SDK: an Interactions request in the background (image-to-video, the start image as
 * the first frame), then GET it until it's done. Each call here is short; the job runner (./jobs) polls across calls.
 * The key (GEMINI_API_KEY) is sent in the x-goog-api-key header only, never in a URL, a log or an error message.
 */
import "server-only";
import { VIDEO_ASPECT, VIDEO_RESOLUTION, VIDEO_SECONDS, videoModel } from "./config";
import type { InteractionLike } from "./jobstate";

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
  const v = it.output_video;
  if (v?.data) return new Uint8Array(Buffer.from(v.data, "base64"));
  if (v?.uri) {
    const r = await fetch(v.uri, { headers: { "x-goog-api-key": key() }, signal: AbortSignal.timeout(60_000) });
    if (!r.ok) throw new VideoApiError(`downloading the video failed: HTTP ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  }
  throw new VideoApiError("no video in the model's answer");
}
