"use client";

/**
 * "Make a video from this ad" under an ad image the creator approved: starts a background video job (outside NEAR AI's
 * TEE; the approved image is the first frame), then checks it every 5 s until the clip is stored and submitted for
 * the creator's review, showing every step. The price is only reserved until the creator approves the video.
 */
import { useEffect, useRef, useState } from "react";
import { btnClass } from "@/components/ds";
import { api } from "@/lib/api";
import { txUrl } from "@/lib/near/config";
import type { VideoJobView } from "@/lib/types";
import type { Step } from "./runAd";

export function MakeVideo({ licenceId, fromSha, seconds, estUsd, onDone }: { licenceId: string; fromSha: string; seconds: number; estUsd: number; onDone: () => void }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const add = (s: Step) => setSteps((x) => [...x, s]);

  async function run() {
    setBusy(true);
    setSteps([]);
    try {
      add({ text: `Starting a ${seconds} s video from the approved ad (made outside NEAR AI's TEE; about $${estUsd.toFixed(2)})…`, tone: "wait" });
      let job = await api<VideoJobView>("/api/agent/video", { licenceId, fromSha256: fromSha });
      add({ text: `Video job #${job.id} started; checking every 5 s (usually 1 to 3 minutes)…`, tone: "wait" });
      let n = 0;
      while (alive.current && (job.status === "running" || job.status === "starting" || job.status === "storing")) {
        await new Promise((r) => setTimeout(r, 5000));
        job = await api<VideoJobView>(`/api/agent/video/${job.id}`, {});
        if (++n % 6 === 0 && job.status === "running") add({ text: `Still making it (${Math.round(job.ageMs / 1000)} s)…`, tone: "wait" });
      }
      if (job.status === "submitted") {
        add({ text: `Stored (sha256 ${job.sha256?.slice(0, 12)}…) and submitted for the creator's review. Price reserved, not paid.`, tone: "ok" });
        if (job.submitTx) add({ text: `Transaction ${job.submitTx.slice(0, 10)}…: ${txUrl(job.submitTx)}` });
      } else if (job.status === "failed" || job.status === "refused") {
        add({ text: `No video: ${job.error ?? job.status}. Never submitted, nothing reserved.`, tone: "bad" });
      }
    } catch (e) {
      add({ text: (e as Error).message, tone: "bad" });
    } finally {
      if (alive.current) setBusy(false);
      onDone();
    }
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <button type="button" disabled={busy} className={btnClass("ink", "self-start")} onClick={() => void run()}>
        {busy ? "Making the video…" : `Make a ${seconds} s video (~$${estUsd.toFixed(2)})`}
      </button>
      {steps.map((s, i) => (
        <p key={i} className={`m-0 break-all text-[12px] ${s.tone === "ok" ? "text-ok" : s.tone === "bad" ? "text-bad" : "text-grey"}`}>
          {s.text}
        </p>
      ))}
    </div>
  );
}
