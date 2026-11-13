"use client";

/**
 * "Make the next ad" for one Active licence (components/brand/runAd.ts): render → AI similarity check (advisory) →
 * on-chain submission for the creator's approval. Shows each step as it happens; the price is only reserved, never
 * paid, until the creator approves.
 */
import { useState } from "react";
import { btnClass } from "@/components/ds";
import { makeOneAd, type Step } from "./runAd";

export function MakeAd({ licenceId, onDone }: { licenceId: string; onDone: () => void }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setSteps([]);
    try {
      await makeOneAd(licenceId, (s) => setSteps((x) => [...x, s]));
    } catch (e) {
      setSteps((x) => [...x, { text: (e as Error).message, tone: "bad" }]);
    } finally {
      setBusy(false);
      onDone();
    }
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <button type="button" disabled={busy} className={btnClass("lime", "self-start")} onClick={() => void run()}>
        {busy ? "Working…" : "Make the next ad (~$0.012 + check)"}
      </button>
      {steps.map((s, i) => (
        <p key={i} className={`m-0 break-all text-[13px] ${s.tone === "ok" ? "text-ok" : s.tone === "bad" ? "text-bad" : "text-grey"}`}>
          {s.text}
        </p>
      ))}
    </div>
  );
}
