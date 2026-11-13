"use client";

/**
 * "Prove your likeness" (optional): consent → a live camera capture with a blink-and-turn check → saved privately.
 * The front frame's sha256 is what the contract records: at registration if the creator proves first, or later with
 * set_capture (one transaction in their wallet). Proving lets brands' agents make ads from a consented reference photo
 * and shows a "Likeness proven" badge; it is not identity verification.
 */
import { useCallback, useState } from "react";
import { btnClass, ErrorCard } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { LivenessCapture } from "./LivenessCapture";
import { runTx, TxLine, type TxState } from "./TxLine";
import { api, NotConnectedError } from "@/lib/api";
import { dataUrlBytes, sha256OfBytes } from "@/lib/capture";
import { calls } from "@/lib/near/methods";
import { useWallet } from "@/lib/near/wallet";
import type { CaptureRequest, CaptureResponse } from "@/lib/types";

type Captured = { frames: string[]; liveness: CaptureRequest["liveness"] };

export const PROVE_WHY =
  "Proving your likeness takes three frames from your camera (front, slight left, slight right) with a blink-and-turn check. They're compressed in your browser and stored privately; the front frame is the reference brands' agents edit, and every ad is checked against it. Never shown publicly, and it is not identity verification.";

/** `registered`: the creator is already on the contract, so saving also sends set_capture from their wallet. */
export function ProveLikeness({ registered, onProven }: { registered: boolean; onProven: (captureSha256: string) => void }) {
  const w = useWallet();
  const [consent, setConsent] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const onCaptured = useCallback((c: Captured) => setCaptured(c), []);

  async function save() {
    if (!captured) return;
    setBusy(true);
    setError(null);
    try {
      const local = await sha256OfBytes(dataUrlBytes(captured.frames[0]!));
      const body: CaptureRequest = { frames: captured.frames, liveness: captured.liveness, consent: true };
      const r = await api<CaptureResponse>("/api/capture", body);
      if (r.captureSha256 !== local) throw new Error("the server stored different bytes than this page captured: try again");
      if (registered) {
        if (!(await runTx(setTx, "Record your proof on NEAR", () => w.call(calls.setCapture(r.captureSha256))))) return;
      }
      onProven(r.captureSha256);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[14px] text-grey">{PROVE_WHY}</p>
      <label className="flex items-start gap-2 text-[15px]">
        <input type="checkbox" className="mt-1 h-4 w-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>I consent to Likeness storing these frames and using the front frame as the reference for AI-edited ads, each of which I approve myself.</span>
      </label>
      {!capturing && !captured && (
        <button type="button" disabled={!consent} onClick={() => setCapturing(true)} className={btnClass("ink", "self-start")}>
          Start the camera
        </button>
      )}
      {capturing && !captured && <LivenessCapture onDone={onCaptured} />}
      {captured && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy || !consent} onClick={() => void save()} className={btnClass("lime")}>
            {busy ? "Saving…" : registered ? "Save and record on NEAR" : "Save my capture"}
          </button>
          <button
            type="button"
            className={btnClass("ghost")}
            onClick={() => {
              setCaptured(null);
              setCapturing(true);
            }}
          >
            Capture again
          </button>
        </div>
      )}
      <TxLine s={tx} />
      {error instanceof NotConnectedError ? <NotConnected what="Saving your capture (/api/capture)" /> : error ? <ErrorCard>{(error as Error).message}</ErrorCard> : null}
    </div>
  );
}
