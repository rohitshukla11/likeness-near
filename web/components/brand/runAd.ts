/**
 * One ad under an Active licence, step by step, for the brand's console: render (one image edit of the creator's
 * reference photo; the agent writes the scene and product first if the brand left them empty) → safety screen on the ad
 * (no minors, nothing sexualised, no other people; no identity judgement) → on-chain submission for the creator's
 * review. Other people in the ad regenerate once with the next prompt, then the ad is dropped. Returns how it ended.
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
    add({ text: `Made ad (prompt ${r.attempt + 1}), sha256 ${r.sha256.slice(0, 12)}…. Running the safety screen…`, tone: "wait" });
    const c = await api<{ status: string; faceCheck: { safety?: string; reason: string | null }; tx?: string }>("/api/agent/check", { sha256: r.sha256 });
    const why = c.faceCheck.reason ? ` (${c.faceCheck.reason})` : "";
    if (c.status === "submitted") {
      add({ text: "Submitted for the creator's review (safety screen passed). Only the creator can confirm it's them. Price reserved, not paid.", tone: "ok" });
      if (c.tx) add({ text: `Transaction ${c.tx.slice(0, 10)}…: ${txUrl(c.tx)}` });
      return "submitted";
    }
    if (c.status === "regenerate") {
      retryOf = r.sha256;
      add({ text: `Other people are in the ad${why}.`, tone: "bad" });
      continue;
    }
    add({ text: c.status === "blocked" ? `Blocked by the safety screen${why}: never submitted, nothing reserved.` : `Dropped${why}: never submitted, nothing reserved.`, tone: "bad" });
    return "stopped";
  }
  return "stopped";
}
