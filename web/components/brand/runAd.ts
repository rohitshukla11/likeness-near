/**
 * One ad under an Active licence, step by step, for the brand's console: render (one image edit of the creator's
 * reference photo; the agent writes the scene and product first if the brand left them empty) → AI similarity check
 * (advisory) → on-chain submission for the creator's approval; a confident "different person" regenerates once with
 * the next prompt. Each step is reported through `add`. Returns how it ended.
 */
import { api } from "@/lib/api";
import { txUrl } from "@/lib/near/config";

export type Step = { text: string; tone?: "ok" | "bad" | "wait" };
export type AdOutcome = "submitted" | "stopped";

export async function makeOneAd(licenceId: string, add: (s: Step) => void): Promise<AdOutcome> {
  let retryOf: string | undefined;
  for (let round = 0; round < 2; round++) {
    add({ text: round ? "Regenerating once with the next prompt…" : "Making the ad: an image edit of the creator's reference photo…", tone: "wait" });
    const r = await api<{ sha256: string; status: string; attempt: number; wrote: { scene: string; product: string } | null }>("/api/agent/render", { licenceId, ...(retryOf ? { retryOf } : {}) });
    if (r.wrote) add({ text: `The agent wrote the scene ("${r.wrote.scene}") and the product ("${r.wrote.product}"), screened for banned uses.` });
    if (r.status === "already_submitted") {
      add({ text: "The model returned an image that was already made: nothing new was submitted.", tone: "bad" });
      return "stopped";
    }
    add({ text: `Made ad (prompt ${r.attempt + 1}), sha256 ${r.sha256.slice(0, 12)}…. Running the AI similarity check (advisory)…`, tone: "wait" });
    const c = await api<{ status: string; faceCheck: { verdict: string; reason: string | null }; tx?: string }>("/api/agent/check", { sha256: r.sha256 });
    const why = c.faceCheck.reason ? ` (${c.faceCheck.reason})` : "";
    if (c.status === "submitted") {
      add({ text: `Submitted for the creator's approval: ${c.faceCheck.verdict === "likely_match" ? "likely the same person" : "flagged for the creator's review"}${why}. Price reserved, not paid.`, tone: "ok" });
      if (c.tx) add({ text: `Transaction ${c.tx.slice(0, 10)}…: ${txUrl(c.tx)}` });
      return "submitted";
    }
    if (c.status === "regenerate") {
      retryOf = r.sha256;
      add({ text: `The check says a different person${why}.`, tone: "bad" });
      continue;
    }
    add({ text: c.status === "blocked" ? `Blocked${why}: never submitted, nothing reserved.` : `A different person again${why}: never submitted, nothing reserved.`, tone: "bad" });
    return "stopped";
  }
  return "stopped";
}
