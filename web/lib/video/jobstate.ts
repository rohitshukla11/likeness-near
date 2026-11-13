/**
 * What a poll does with the model's answer (the Gemini API Interactions resource): keep waiting, store the finished
 * clip, or fail with a reason (the model's own refusal, an empty answer, or our deadline). Pure.
 */
import { JOB_DEADLINE_MS } from "./config.ts";

export interface InteractionLike {
  id?: string;
  status?: string;
  output_video?: { data?: string; uri?: string; mime_type?: string };
}

export type JobStep = { kind: "wait" } | { kind: "done" } | { kind: "failed"; reason: string; cancel: boolean };

const ENDED_BAD = new Set(["failed", "cancelled", "incomplete", "budget_exceeded"]);

export function nextStep(it: InteractionLike, ageMs: number, deadlineMs = JOB_DEADLINE_MS): JobStep {
  if (it.status === "completed") {
    return it.output_video?.data || it.output_video?.uri ? { kind: "done" } : { kind: "failed", reason: "the model declined to make this video (no video returned)", cancel: false };
  }
  if (it.status && ENDED_BAD.has(it.status)) return { kind: "failed", reason: `the model ended the video as ${it.status}`, cancel: false };
  if (ageMs > deadlineMs) return { kind: "failed", reason: `not finished after ${Math.round(deadlineMs / 60_000)} minutes: cancelled`, cancel: true };
  return { kind: "wait" };
}
