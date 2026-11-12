"use client";

/**
 * A creator joins in two steps: a live camera capture (blink and turn; no uploads) they consent to, then their terms,
 * registered on-chain from their own wallet together with the sha256 of the consented front frame.
 */
import { useCallback, useState } from "react";
import { btnClass, Card, ErrorCard } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { LivenessCapture } from "@/components/likeness/LivenessCapture";
import { RulesForm } from "@/components/likeness/RulesForm";
import { runTx, TxLine, type TxState } from "@/components/likeness/TxLine";
import { api, NotConnectedError } from "@/lib/api";
import { dataUrlBytes, sha256OfBytes } from "@/lib/capture";
import { calls } from "@/lib/near/methods";
import { useWallet } from "@/lib/near/wallet";
import type { CaptureRequest, CaptureResponse, MeResponse } from "@/lib/types";

type Captured = { frames: string[]; liveness: CaptureRequest["liveness"] };

export function Onboarding({ me, onDone }: { me: MeResponse | null; onDone: () => void }) {
  const w = useWallet();
  const [consent, setConsent] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [saved, setSaved] = useState<CaptureResponse | null>(me?.capture ?? null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });

  const onCaptured = useCallback((c: Captured) => setCaptured(c), []);

  async function save() {
    if (!captured) return;
    setBusy(true);
    setSaveError(null);
    try {
      const local = await sha256OfBytes(dataUrlBytes(captured.frames[0]!));
      const body: CaptureRequest = { frames: captured.frames, liveness: captured.liveness, consent: true };
      const r = await api<CaptureResponse>("/api/capture", body);
      if (r.captureSha256 !== local) throw new Error("the server stored different bytes than this page captured: try again");
      setSaved(r);
    } catch (e) {
      setSaveError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <Card title="1. Your live capture">
        {saved ? (
          <p className="m-0 text-[15px]">
            Saved with your consent. Front frame sha256 <code className="break-all text-[13px]">{saved.captureSha256}</code>
          </p>
        ) : (
          <>
            <p className="m-0 text-[15px] text-grey">
              Three frames from your camera (front, slight left, slight right) with a blink-and-turn check. They&apos;re compressed in your browser,
              stored privately, and the front frame is the reference for ads you approve one by one. Never shown publicly.
            </p>
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
                  {busy ? "Saving…" : "Save my capture"}
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
            {saveError instanceof NotConnectedError ? (
              <NotConnected what="Saving your capture (/api/capture)">
                <p className="mt-2 mb-0 text-[14px] text-grey">Your frames stay in this tab; nothing was uploaded or registered.</p>
              </NotConnected>
            ) : saveError ? (
              <ErrorCard>{(saveError as Error).message}</ErrorCard>
            ) : null}
          </>
        )}
      </Card>

      <Card title="2. Your terms, registered on NEAR">
        {!saved ? (
          <p className="m-0 text-[15px] text-grey">Save your capture first: your on-chain record names its sha256.</p>
        ) : (
          <>
            <RulesForm
              submitLabel="Register on NEAR"
              onSubmit={async (terms) => {
                const ok = await runTx(setTx, "Register as a creator", () => w.call(calls.registerCreator(terms, saved.captureSha256)));
                if (ok) onDone();
              }}
            />
            <TxLine s={tx} />
          </>
        )}
      </Card>
    </div>
  );
}
