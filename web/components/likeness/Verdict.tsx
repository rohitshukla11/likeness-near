/**
 * Verify's answer for one file, read from the contract: Licensed / Expired / Revoked / Unknown, the licence token,
 * who licensed whom for what, and what the receipt records (the amount and the advisory similarity check).
 */
import { StatusPill, type PillKind } from "@/components/ds";
import { accountUrl } from "@/lib/near/config";
import { formatNear, USE_LABELS } from "@/lib/rules";
import type { Verdict as V, VerifyResult } from "@/lib/types";
import { isSelfLicence, SELF_LICENCE_NOTE } from "./SelfLicence";

const LOOK: Record<V, { pill: PillKind; title: string; body: string }> = {
  Licensed: { pill: "licensed", title: "Licensed", body: "The creator approved this exact file in their own wallet, was paid for it, and the licence is in force." },
  Expired: { pill: "expired", title: "Expired", body: "This file was approved, but its licence has ended. It may no longer be used." },
  Revoked: { pill: "revoked", title: "Revoked", body: "The creator revoked this licence. The file may no longer be used." },
  Unknown: { pill: "neutral", title: "Unknown", body: "No approved receipt for this file. Either it wasn't made through Likeness, it was changed (any edit changes the hash), or its creator never approved it." },
};
const day = (ms: number | null | undefined) => (ms ? new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");

export function Verdict({ r }: { r: VerifyResult }) {
  const look = LOOK[r.verdict];
  const l = r.licence;
  const rc = r.receipt;
  return (
    <section aria-live="polite" className="flex flex-col gap-3 rounded-[20px] bg-white p-5 text-[15px]">
      <span className="flex flex-wrap items-center gap-3">
        <StatusPill kind={look.pill}>{look.title}</StatusPill>
        {r.tokenId && <span className="text-grey">Licence token #{r.tokenId}</span>}
      </span>
      <p className="m-0">{look.body}</p>
      {l && isSelfLicence(l) && <p className="m-0 text-[14px] font-semibold text-wait">{SELF_LICENCE_NOTE}</p>}
      <p className="m-0 break-all text-[13px] text-grey">
        sha256 <code>{r.sha256}</code>
      </p>
      {l && (
        <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-[14px]">
          <dt className="text-grey">Creator</dt>
          <dd className="m-0">
            <a href={accountUrl(l.creator)} target="_blank" rel="noreferrer">
              {l.creator}
            </a>
          </dd>
          <dt className="text-grey">Brand</dt>
          <dd className="m-0">
            <a href={accountUrl(l.brand)} target="_blank" rel="noreferrer">
              {l.brand}
            </a>
          </dd>
          <dt className="text-grey">Use</dt>
          <dd className="m-0">{USE_LABELS[l.use]}</dd>
          <dt className="text-grey">Licence</dt>
          <dd className="m-0">
            #{l.id}, {l.status}, {l.rendersUsed}/{l.renderCap} renders, until {day(l.expiresAt)}
          </dd>
          {rc && (
            <>
              <dt className="text-grey">Paid</dt>
              <dd className="m-0">
                {formatNear(rc.amount)} ({rc.status}, {day(rc.decidedAt)})
              </dd>
              <dt className="text-grey">AI similarity check (advisory)</dt>
              <dd className="m-0">{rc.faceCheck === "likely_match" ? "likely the same person" : "flagged for the creator's review; the creator decided"}</dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}
