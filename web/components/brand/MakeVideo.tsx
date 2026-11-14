"use client";

/**
 * "Make a video" (components/brand/runVideo.ts): on an Active licence it makes the video directly (its own opening
 * still from the creator's photo); under an approved ad image (`fromSha`) it animates that ad. Shows every step; the
 * price is only reserved until the creator approves the video.
 */
import { useEffect, useRef, useState } from "react";
import { btnClass } from "@/components/ds";
import type { Step } from "./runAd";
import { makeOneVideo } from "./runVideo";

export function MakeVideo({ licenceId, fromSha, seconds, estUsd, onDone }: { licenceId: string; fromSha?: string; seconds: number; estUsd: number; onDone: () => void }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const running = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function run() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setSteps([]);
    try {
      await makeOneVideo(licenceId, (s) => setSteps((x) => [...x, s]), { seconds, estUsd, fromSha, alive: () => alive.current });
    } catch (e) {
      setSteps((x) => [...x, { text: (e as Error).message, tone: "bad" }]);
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
      onDone();
    }
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <button type="button" disabled={busy} className={btnClass("ink", "self-start")} onClick={() => void run()}>
        {busy ? "Making the video…" : `${fromSha ? "Make a video from this ad" : "Make a video"} (${seconds} s, ~$${estUsd.toFixed(2)})`}
      </button>
      {steps.map((s, i) => (
        <p key={i} className={`m-0 break-all text-[13px] ${s.tone === "ok" ? "text-ok" : s.tone === "bad" ? "text-bad" : "text-grey"}`}>
          {s.text}
        </p>
      ))}
    </div>
  );
}
