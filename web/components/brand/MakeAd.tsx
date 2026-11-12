"use client";

/**
 * "Make the next ad" for one Active licence: render (one image edit, ~$0.012) → AI similarity check (advisory) → on-chain
 * submission for the creator's approval; a confident "different person" regenerates once with the next prompt.
 * Shows each step as it happens; the price is only reserved, never paid, until the creator approves.
 */
import { useState } from "react";
import { btnClass } from "@/components/ds";
import { api } from "@/lib/api";
import { txUrl } from "@/lib/near/config";

type Step = { text: string; tone?: "ok" | "bad" | "wait" };

export function MakeAd({ licenceId, onDone }: { licenceId: string; onDone: () => void }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const add = (s: Step) => setSteps((x) => [...x, s]);

  async function run() {
    setBusy(true);
    setSteps([]);
    try {
      let retryOf: string | undefined;
      for (let round = 0; round < 2; round++) {
        add({ text: round ? "Regenerating once with the next prompt…" : "Making the ad (image edit of the consented photo)…", tone: "wait" });
        const r = await api<{ sha256: string; status: string; attempt: number }>("/api/agent/render", { licenceId, ...(retryOf ? { retryOf } : {}) });
        if (r.status === "already_submitted") {
          add({ text: "The model returned an image that was already made: nothing new was submitted.", tone: "bad" });
          return;
        }
        add({ text: `Made ad (prompt ${r.attempt + 1}), sha256 ${r.sha256.slice(0, 12)}…. Running the AI similarity check (advisory)…`, tone: "wait" });
        const c = await api<{ status: string; faceCheck: { verdict: string; reason: string | null }; tx?: string }>("/api/agent/check", { sha256: r.sha256 });
        const why = c.faceCheck.reason ? ` (${c.faceCheck.reason})` : "";
        if (c.status === "submitted") {
          add({ text: `Submitted for the creator's approval: ${c.faceCheck.verdict === "likely_match" ? "likely the same person" : "flagged for the creator's review"}${why}. Price reserved, not paid.`, tone: "ok" });
          if (c.tx) add({ text: `Transaction ${c.tx.slice(0, 10)}…: ${txUrl(c.tx)}` });
          return;
        }
        if (c.status === "regenerate") {
          retryOf = r.sha256;
          add({ text: `The check says a different person${why}.`, tone: "bad" });
          continue;
        }
        add({ text: c.status === "blocked" ? `Blocked${why}: never submitted, nothing reserved.` : `A different person again${why}: never submitted, nothing reserved.`, tone: "bad" });
        return;
      }
    } catch (e) {
      add({ text: (e as Error).message, tone: "bad" });
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
