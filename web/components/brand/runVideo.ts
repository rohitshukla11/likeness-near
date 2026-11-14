/**
 * One video under an Active licence, step by step (the third-party video model in lib/video, not NEAR AI). Direct:
 * the server makes its own opening still from the creator's reference photo, safety-screens it, and animates it; with
 * `fromSha` it animates that approved ad instead. Then the page checks every 5 s until the clip is stored and submitted
 * for the creator's review. The price is only reserved until the creator approves the video. Returns how it ended.
 */
import { api } from "@/lib/api";
import { txUrl } from "@/lib/near/config";
import type { VideoJobView } from "@/lib/types";
import type { AdOutcome, Step } from "./runAd";

export async function makeOneVideo(
  licenceId: string,
  add: (s: Step) => void,
  o: { seconds: number; estUsd: number; fromSha?: string; alive?: () => boolean },
): Promise<AdOutcome> {
  const alive = o.alive ?? (() => true);
  add({
    text: o.fromSha
      ? `Starting a ${o.seconds} s video from the approved ad (made by a third-party video model, not NEAR AI; about $${o.estUsd.toFixed(2)})…`
      : `Making a ${o.seconds} s video: an opening still from the creator's photo, the safety screen, then the animation (a third-party video model, not NEAR AI; about $${o.estUsd.toFixed(2)})…`,
    tone: "wait",
  });
  let job = await api<VideoJobView>("/api/agent/video", { licenceId, ...(o.fromSha ? { fromSha256: o.fromSha } : {}) });
  add({ text: `Video job #${job.id} started; checking every 5 s (usually 1 to 3 minutes)…`, tone: "wait" });
  let n = 0;
  while (alive() && (job.status === "running" || job.status === "starting" || job.status === "storing")) {
    await new Promise((r) => setTimeout(r, 5000));
    job = await api<VideoJobView>(`/api/agent/video/${job.id}`, {});
    if (++n % 6 === 0 && job.status === "running") add({ text: `Still making it (${Math.round(job.ageMs / 1000)} s)…`, tone: "wait" });
  }
  if (job.status === "submitted") {
    add({ text: `Stored (sha256 ${job.sha256?.slice(0, 12)}…) and submitted for the creator's review. Price reserved, not paid.`, tone: "ok" });
    if (job.submitTx) add({ text: `Transaction ${job.submitTx.slice(0, 10)}…: ${txUrl(job.submitTx)}` });
    return "submitted";
  }
  if (job.status === "failed" || job.status === "refused") add({ text: `No video: ${job.error ?? job.status}. Never submitted, nothing reserved.`, tone: "bad" });
  return "stopped";
}
