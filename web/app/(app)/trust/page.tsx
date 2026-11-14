"use client";

/**
 * /trust: where faces are processed, and the live proof for the AI part. For each NEAR AI model this app sends faces
 * to, the latest TEE attestation the server verified (fresh nonce, Intel TDX quote, key binding, NVIDIA GPUs), when,
 * and the raw report to download and check yourself. Also what is NOT in a TEE.
 */
import { useEffect, useState } from "react";
import { AppPage, Card, ErrorCard, Skeleton, StatusPill } from "@/components/ds";
import { api } from "@/lib/api";
import { shortModel } from "@/lib/tee/label";
import { VIDEO_TRUST_NOTE } from "@/lib/video/config";

interface ModelStatus {
  model: string;
  role: string;
  verified: boolean;
  verifiedAt: string;
  failed: string[];
  error: string | null;
  nonce: string;
  signingAddress: string | null;
  reportSha256: string;
  checks: {
    nonce: boolean;
    tdx: { ok: boolean; quoteSignature: boolean; qeReport: boolean; qeBindsKey: boolean; chainToIntelRoot: boolean; certsValidNow: boolean } | null;
    binding: boolean;
    gpu: { ok: boolean; overall: boolean; nonce: boolean; tokensSigned: boolean; notExpired: boolean; gpus: number; gpusOk: boolean; hwmodel: string | null } | null;
    tcbStatusChecked: false;
  };
}

const tick = (ok: boolean | undefined) => (ok ? "✓" : "✗");

export default function TrustPage() {
  const [data, setData] = useState<ModelStatus[] | null>(null);
  const [off, setOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ enabled: boolean; models: ModelStatus[] }>("/api/tee/status")
      .then((r) => {
        setOff(!r.enabled);
        setData(r.models);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <AppPage title="Trust" description="Where a creator's face is processed, and the live proof for the AI part. Checked by this app's server, not just claimed.">
      {off ? (
        <Card>
          <p className="m-0 text-[15px]">TEE attestation checks are switched off on this server right now, so no ad made now carries a TEE record.</p>
        </Card>
      ) : error ? (
        <ErrorCard>{`The attestation couldn't be checked just now: ${error}`}</ErrorCard>
      ) : !data ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
          {data.map((m) => (
            <Card key={m.model}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-[17px]">NEAR AI · {shortModel(m.model)}</b>
                <StatusPill kind={m.verified ? "licensed" : "revoked"}>{m.verified ? "TEE verified" : "not verified"}</StatusPill>
              </div>
              <p className="m-0 mt-1 text-[13px] text-grey">
                {m.role} · checked {new Date(m.verifiedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium" })}
              </p>
              <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0 text-[14px]">
                <li>{tick(m.checks.nonce)} A fresh 32-byte nonce, echoed back by the model and the gateway</li>
                <li>
                  {tick(m.checks.tdx?.ok)} Intel TDX quote: signature {tick(m.checks.tdx?.quoteSignature)}, QE report {tick(m.checks.tdx?.qeReport)}, key binding {tick(m.checks.tdx?.qeBindsKey)}, chain to Intel&apos;s SGX Root CA {tick(m.checks.tdx?.chainToIntelRoot)}, certificates valid {tick(m.checks.tdx?.certsValidNow)}
                </li>
                <li>{tick(m.checks.binding)} The quote binds the model&apos;s signing key and our nonce</li>
                <li>
                  {tick(m.checks.gpu?.ok)} NVIDIA attestation (NRAS): verdict {tick(m.checks.gpu?.overall)}, tokens signed by NVIDIA {tick(m.checks.gpu?.tokensSigned)}, our nonce {tick(m.checks.gpu?.nonce)}, {m.checks.gpu?.gpus ?? 0}× {m.checks.gpu?.hwmodel ?? "GPU"} measurements and debug-off {tick(m.checks.gpu?.gpusOk)}
                </li>
                <li className="text-grey">Not checked: Intel&apos;s TCB status (platform firmware level).</li>
              </ul>
              {m.error && <p className="m-0 mt-2 text-[13px] text-bad">Error: {m.error}</p>}
              <p className="m-0 mt-3 break-all text-[12px] text-grey">
                Signing key {m.signingAddress ?? "—"} · nonce {m.nonce.slice(0, 16)}… · report sha256 {m.reportSha256 || "—"}
              </p>
              <a href={`/api/tee/status?model=${encodeURIComponent(m.model)}&raw=1`} className="mt-2 inline-block text-[13px] font-semibold underline">
                Download the raw attestation report
              </a>
            </Card>
          ))}
          <Card title="Not in a TEE">
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[14px]">
              <li>The app server (Render) and the database (Neon): they handle and store the photos; stored privately, not in a TEE.</li>
              <li>{VIDEO_TRUST_NOTE}</li>
              <li>Requests reach NEAR AI through its API gateway.</li>
            </ul>
          </Card>
        </div>
      )}
    </AppPage>
  );
}
