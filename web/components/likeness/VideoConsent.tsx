"use client";

/**
 * The creator's opt-in to video, off by default. Videos are made outside NEAR AI's TEE, from an ad image the creator
 * already approved; each video is a render the creator watches and approves (or rejects) like any ad. Hidden when
 * video is off on this server.
 */
import { useEffect, useState } from "react";
import { ErrorCard, StatusPill } from "@/components/ds";
import { api } from "@/lib/api";
import { MUTED, SURFACE } from "./Dash";

type Settings = { allowVideo: boolean; videoEnabled: boolean };

export const VIDEO_CONSENT_LABEL = "Allow video (processed by Google Gemini Omni Flash, outside NEAR AI's TEE)";

export function VideoConsent() {
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<Settings>("/api/creator/settings")
      .then((r) => !cancelled && setS(r))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  if (!s?.videoEnabled) return null;

  return (
    <section className={`${SURFACE} flex flex-col gap-3 p-5 sm:p-6`} aria-label="Video">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[20px] font-bold">Video</h2>
        {s.allowVideo ? <StatusPill kind="licensed">Allowed</StatusPill> : <StatusPill kind="neutral">Off</StatusPill>}
      </div>
      <label className="flex items-start gap-3 text-[15px]">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5"
          checked={s.allowVideo}
          disabled={busy}
          onChange={async (e) => {
            const allowVideo = e.target.checked;
            setBusy(true);
            setError(null);
            try {
              setS(await api<Settings>("/api/creator/settings", { allowVideo }));
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
        <span className="font-semibold">{VIDEO_CONSENT_LABEL}</span>
      </label>
      <p className={`m-0 text-[14px] ${MUTED}`}>
        Off by default. When on, a brand&apos;s agent may turn an ad image you already approved into a short video. You watch and approve every video
        yourself; it counts as a render and is paid like one. Your images are still made on NEAR AI; only videos leave its TEE.
      </p>
      {error && <ErrorCard>{error}</ErrorCard>}
    </section>
  );
}
