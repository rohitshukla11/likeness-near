/**
 * What a poll does with the model's answer (the Gemini API Interactions resource): keep waiting, store the finished
 * clip, or fail with a reason (the model's own refusal, an empty answer, or our deadline). Pure.
 */
import { JOB_DEADLINE_MS } from "./config.ts";

export interface VideoContent {
  type?: string;
  data?: string;
  uri?: string;
  mime_type?: string;
}

/**
 * The REST resource carries the clip in steps[] (a "model_output" step whose content has a "video" item); the SDK's
 * output_video is a convenience copy of that, and some older models answer with a flat outputs[] array.
 */
export interface InteractionLike {
  id?: string;
  status?: string;
  steps?: { type?: string; content?: VideoContent[] }[];
  outputs?: VideoContent[];
  output_video?: VideoContent;
}

const hasClip = (c: VideoContent | undefined): c is VideoContent => !!c && c.type === "video" && !!(c.data || c.uri);

/** The finished clip, read as the SDK does: the latest video item in the model's output steps after the last user input. */
export function videoOf(it: InteractionLike): VideoContent | null {
  if (it.output_video && (it.output_video.data || it.output_video.uri)) return it.output_video;
  const steps = it.steps ?? [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]!;
    if (s.type === "user_input") break;
    if (s.type !== "model_output" || !s.content) continue;
    for (let j = s.content.length - 1; j >= 0; j--) if (hasClip(s.content[j])) return s.content[j]!;
  }
  for (let j = (it.outputs?.length ?? 0) - 1; j >= 0; j--) if (hasClip(it.outputs![j])) return it.outputs![j]!;
  return null;
}

export type JobStep = { kind: "wait" } | { kind: "done" } | { kind: "failed"; reason: string; cancel: boolean };

const ENDED_BAD = new Set(["failed", "cancelled", "incomplete", "budget_exceeded"]);

export function nextStep(it: InteractionLike, ageMs: number, deadlineMs = JOB_DEADLINE_MS): JobStep {
  if (it.status === "completed") {
    return videoOf(it) ? { kind: "done" } : { kind: "failed", reason: "the model declined to make this video (no video returned)", cancel: false };
  }
  if (it.status && ENDED_BAD.has(it.status)) return { kind: "failed", reason: `the model ended the video as ${it.status}`, cancel: false };
  if (ageMs > deadlineMs) return { kind: "failed", reason: `not finished after ${Math.round(deadlineMs / 60_000)} minutes: cancelled`, cancel: true };
  return { kind: "wait" };
}
