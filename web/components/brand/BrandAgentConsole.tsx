"use client";

/**
 * The brand dashboard's lower half: the licences the agent holds (each an on-chain licence
 * token, with "Make the next ad" while it has room), the ads it made, and the agent's activity log with a reason for
 * every step. Pure views: BrandWorkspace loads the data. "Agents propose. Only the human consents."
 */
import Link from "next/link";
import { StatusPill, type PillKind } from "@/components/ds";
import { MUTED, SURFACE } from "@/components/likeness/Dash";
import { ReceiptTile } from "@/components/likeness/ReceiptTile";
import { SelfLicenceBadge } from "@/components/likeness/SelfLicence";
import { LikenessChip, NOT_PROVEN_NOTE } from "@/components/likeness/Proven";
import { CreatorAvatar, SyntheticBadge } from "@/components/likeness/Synthetic";
import { txUrl } from "@/lib/near/config";
import { formatNear, USE_LABELS } from "@/lib/rules";
import { displayName } from "@/lib/profiles";
import type { ActivityEvent, CreatorView, LicenceStatus, LicenceView, RenderItem } from "@/lib/types";
import { LicenceActions } from "./LicenceActions";
import { MakeAd } from "./MakeAd";

const LICENCE_PILL: Record<LicenceStatus, PillKind> = { Pending: "waiting", Declined: "neutral", Active: "licensed", Exhausted: "expired", Expired: "expired", Revoked: "revoked" };
const EVENT_PILL: Record<ActivityEvent["kind"], PillKind> = { shortlist: "lime", skip: "neutral", request: "waiting", render: "waiting", check: "waiting", submit: "licensed", blocked: "revoked", error: "revoked" };

export function BrandLicences({ licences, creators, onChanged, preview = false }: { licences: LicenceView[]; creators?: CreatorView[] | null; onChanged: () => void; preview?: boolean }) {
  /** Creators known not to have proven their likeness (unknown creators get no label). */
  const unproven = new Set((creators ?? []).filter((c) => !c.captureSha256).map((c) => c.accountId));
  return (
    <section id="licences" className={`${SURFACE} flex scroll-mt-4 flex-col gap-3 p-5`} aria-label="Licences">
      <h2 className="m-0 text-[20px] font-bold">Licences</h2>
      {licences.length ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {licences.map((l) => (
            <li key={l.id} className="flex gap-3 rounded-[16px] bg-paper p-3">
              <CreatorAvatar accountId={l.creator} size={56} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="text-[15px]">
                    {displayName(l.creator)} · {USE_LABELS[l.use]} at {formatNear(l.price)}
                  </b>
                  <StatusPill kind={LICENCE_PILL[l.status]}>{l.status === "Pending" ? "Waiting for the creator" : l.status}</StatusPill>
                </div>
                <span className="flex flex-wrap gap-1.5">
                  <SelfLicenceBadge l={l} />
                  <SyntheticBadge accountId={l.creator} />
                  {unproven.has(l.creator) && <LikenessChip proven={false} />}
                </span>
                <span className={`text-[13px] ${MUTED}`}>
                  {l.rendersUsed}/{l.renderCap} renders used{l.rendersReserved ? `, ${l.rendersReserved} waiting for the creator` : ""}
                  {l.tokenId ? ` · licence token #${l.tokenId}` : " · no token until the creator approves"}
                </span>
                {l.status === "Active" && l.rendersUsed + l.rendersReserved < l.renderCap &&
                  (unproven.has(l.creator) ? <span className={`text-[13px] ${MUTED}`}>{NOT_PROVEN_NOTE}</span> : !preview && <MakeAd licenceId={l.id} onDone={onChanged} />)}
                {!preview && <LicenceActions l={l} onDone={onChanged} />}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-start gap-2 rounded-[16px] bg-paper p-4">
          <b className="text-[15px]">No licences yet</b>
          <span className={`text-[14px] ${MUTED}`}>Brief your agent above; it asks a creator whose terms fit, and the creator decides.</span>
        </div>
      )}
    </section>
  );
}

export function BrandAds({ renders }: { renders: RenderItem[] }) {
  return (
    <section className="flex flex-col gap-3" aria-label="Ads">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="m-0 text-[20px] font-bold">Ads</h2>
        {renders.length > 0 && <span className={`text-[13px] ${MUTED}`}>{renders.filter((r) => r.receipt.status === "Approved").length} approved by their creators</span>}
      </div>
      {renders.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {renders.map((it) => (
            <ReceiptTile key={it.receipt.sha256} item={it} />
          ))}
        </div>
      ) : (
        <div className={`${SURFACE} p-5 text-[14px] ${MUTED}`}>An ad is paid for only after its creator approves that exact file in their wallet; until then its price is only reserved.</div>
      )}
    </section>
  );
}

export function AgentActivity({ events }: { events: ActivityEvent[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-[22px] bg-ink p-5 text-white" aria-label="Agent activity">
      <h2 className="m-0 text-[20px] font-bold">Agent activity</h2>
      {events.length ? (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {events.map((e, i) => (
            <li key={i} className="flex flex-col gap-0.5 border-b border-white/10 pb-2 text-[13px] last:border-0">
              <span className="flex items-center gap-2">
                <StatusPill kind={EVENT_PILL[e.kind] ?? "neutral"}>{e.kind}</StatusPill>
                <time dateTime={new Date(e.at).toISOString()} suppressHydrationWarning className="text-[#B9BCC4]">
                  {new Date(e.at).toLocaleTimeString()}
                </time>
              </span>
              <span className="text-white [overflow-wrap:anywhere]">{e.summary}</span>
              <span className="flex gap-3">
                {e.sha256 && (
                  <Link href={`/verify?sha256=${e.sha256}`} className="text-lime">
                    verify
                  </Link>
                )}
                {e.tx && (
                  <a href={txUrl(e.tx)} target="_blank" rel="noreferrer" className="text-lime">
                    transaction ↗
                  </a>
                )}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="m-0 text-[14px] text-[#B9BCC4]">
          The agent&apos;s steps show here: screened → shortlisted (a reason for every pick and skip) → licence asked → ad made → similarity checked →
          submitted, or blocked with the reason.
        </p>
      )}
    </section>
  );
}
