"use client";

/**
 * What the app verified about where an ad was processed. For an image: one row per NEAR AI model it went through (the
 * FLUX edit, the Qwen safety screen), "Processed in a verified TEE … ✓" only when every attestation check passed
 * (lib/tee/label.ts), else "not verified" naming the failed check; Details lists each check and the report hash.
 * Nothing is shown for an ad without a record (attestation off, or a video). Intel's TCB status is never claimed.
 */
import Link from "next/link";
import { hasTeeRecord, shortModel, teeLabel, TEE_CHECK_NAMES } from "@/lib/tee/label";
import type { RenderTee, TeeSummaryView } from "@/lib/types";
import { VIDEO_TEE_SHORT } from "@/lib/video/config";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
const tick = (ok: boolean) => (ok ? "✓" : "✗");

function Row({ s, role }: { s: TeeSummaryView | null; role: string }) {
  const l = teeLabel(s);
  return (
    <div className="flex flex-col gap-1 rounded-[12px] bg-paper px-3 py-2 text-[13px]">
      {s && l.verified ? (
        <span className="font-semibold text-ok">
          🔒 Processed in a verified TEE: NEAR AI · {shortModel(s.model)} · verified at {when(s.verifiedAt)} ✓
        </span>
      ) : (
        <span className="font-semibold text-bad">
          {role}: {l.text}
          {s ? ` · ${shortModel(s.model)}` : ""}
        </span>
      )}
      <span className="text-grey">{role}</span>
      {s && (
        <details>
          <summary className="cursor-pointer text-grey">Details</summary>
          <ul className="m-0 mt-1 list-none p-0 text-grey">
            <li>{tick(s.gpuOk)} NVIDIA GPU attestation (NRAS-signed, our nonce, measurements match)</li>
            <li>{tick(s.tdxOk)} Intel TDX quote signed up to Intel&apos;s root CA</li>
            <li>{tick(s.bindingOk)} Quote binds the model&apos;s signing key {s.signingAddress ? <code className="break-all">{s.signingAddress}</code> : null} and our nonce</li>
            <li>{tick(s.nonceOk)} Fresh nonce echoed back</li>
            <li className="break-all">Report sha256 {s.reportSha256 || "—"}</li>
            {s.failed.length > 0 && <li>Failed: {s.failed.map((f) => TEE_CHECK_NAMES[f] ?? f).join(", ")}</li>}
            <li>Not checked: Intel&apos;s TCB status (platform firmware level).</li>
          </ul>
        </details>
      )}
    </div>
  );
}

export function TeePanel({ tee, video }: { tee: RenderTee | null | undefined; video: boolean }) {
  // Nothing TEE-related without a record (attestation off, or an ad from before); a video never has one (the review
  // page already carries the video disclosure).
  if (video || !hasTeeRecord(tee)) return null;
  return (
    <div className="flex flex-col gap-2">
      <Row s={tee?.image ?? null} role="Image edit (FLUX.2-klein)" />
      <Row s={tee?.screen ?? null} role="Safety screen (Qwen)" />
      <Link href="/trust" className="text-[12px] text-grey underline">
        How this is checked →
      </Link>
    </div>
  );
}

/** One line for Verify: an image's AI processing, or a video. */
export function TeeLine({ kind, image, screen }: { kind: "image" | "video"; image: TeeSummaryView | null; screen: TeeSummaryView | null }) {
  if (kind === "video") return <p className="m-0 text-[14px] text-grey">{VIDEO_TEE_SHORT}</p>;
  const ok = teeLabel(image).verified && teeLabel(screen).verified;
  return (
    <p className={`m-0 text-[14px] ${ok ? "font-semibold text-ok" : "text-grey"}`}>
      {ok ? "🔒 AI processing: verified TEE (NEAR AI)" : !image && !screen ? "AI processing: NEAR AI (no TEE attestation recorded for this ad)" : "AI processing: NEAR AI, TEE attestation not verified"}{" "}
      <Link href="/trust" className="text-[12px] font-normal text-grey underline">
        details
      </Link>
    </p>
  );
}
