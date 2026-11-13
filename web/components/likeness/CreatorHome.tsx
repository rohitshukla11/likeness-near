"use client";

/**
 * A registered creator's dashboard: their profile and status chips, what they've
 * earned, everything waiting for their decision (licence requests and ads), every ad made with their face, their
 * terms on-chain, and the public record anyone can check. Every decision is a transaction they sign in their wallet.
 * `CreatorHome` loads the data; `CreatorDashboardView` only renders it (the local preview reuses it with test data).
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { btnClass, ErrorCard, StatusPill, type PillKind } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { BigAvatar, CHIP, Fact, MUTED, OUTLINE, ProfileHeader, Rule, shortDay, Stat, SURFACE } from "./Dash";
import { RulesForm } from "./RulesForm";
import { SelfLicenceBadge } from "./SelfLicence";
import { AdMedia, isVideo } from "./LabelledVideo";
import { LikenessChip } from "./Proven";
import { SyntheticBadge, SyntheticNote } from "./Synthetic";
import { runTx, TxLine, type TxState } from "./TxLine";
import { api, NotConnectedError } from "@/lib/api";
import { accountUrl, CONTRACT_ID, txUrl } from "@/lib/near/config";
import { calls, type ContractCall } from "@/lib/near/methods";
import { useWallet } from "@/lib/near/wallet";
import { formatNear, USE_LABELS } from "@/lib/rules";
import { displayName, profileOf } from "@/lib/profiles";
import type { CreatorInbox, CreatorView, LicenceStatus, LicenceView, RenderItem, ReceiptStatus } from "@/lib/types";

const LICENCE_PILL: Record<LicenceStatus, PillKind> = { Pending: "waiting", Declined: "neutral", Active: "licensed", Exhausted: "expired", Expired: "expired", Revoked: "revoked" };
const AD_PILL: Record<ReceiptStatus, PillKind> = { Reserved: "waiting", Approved: "licensed", Rejected: "revoked", Released: "expired" };
const AD_LABEL: Record<ReceiptStatus, string> = { Reserved: "Waiting for you", Approved: "Approved, paid", Rejected: "Rejected", Released: "Released, not paid" };

export type Act = (what: string, call: ContractCall) => Promise<void>;

/** Loads the creator's inbox and runs their wallet decisions. */
export function CreatorHome({ creator, captureSha, onSwitchToBrand }: { creator: CreatorView; captureSha: string | null; onSwitchToBrand: () => void }) {
  const w = useWallet();
  const [inbox, setInbox] = useState<CreatorInbox | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((n) => n + 1), []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const i = await api<CreatorInbox>("/api/creator/inbox");
        if (!cancelled) {
          setInbox(i);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);
  const act: Act = async (what, call) => {
    if (await runTx(setTx, what, () => w.call(call))) refresh();
  };
  return (
    <CreatorDashboardView
      creator={creator}
      inbox={inbox}
      faceSrc={profileOf(creator.accountId)?.face ?? (captureSha ? `/api/media/${captureSha}` : null)}
      notice={loadError instanceof NotConnectedError ? <NotConnected what="Your requests and ads (/api/creator/inbox)" /> : loadError ? <ErrorCard>{(loadError as Error).message}</ErrorCard> : null}
      tx={<TxLine s={tx} />}
      act={act}
      onSwitchToBrand={onSwitchToBrand}
    />
  );
}

export function CreatorDashboardView({
  creator,
  inbox,
  faceSrc,
  notice,
  tx,
  act,
  onSwitchToBrand,
}: {
  creator: CreatorView;
  inbox: CreatorInbox | null;
  faceSrc: string | null;
  notice?: React.ReactNode;
  tx?: React.ReactNode;
  act: Act;
  onSwitchToBrand: () => void;
}) {
  const [editTerms, setEditTerms] = useState(false);
  const licences = inbox?.licences ?? [];
  const requests = licences.filter((l) => l.status === "Pending");
  const pendingAds = inbox?.pending ?? [];
  const ads = [...pendingAds, ...(inbox?.decided ?? [])];
  const waiting = requests.length + pendingAds.length;
  const approvedAds = (inbox?.decided ?? []).filter((a) => a.receipt.status === "Approved").length;
  const revokedAds = ads.filter((a) => a.licence.status === "Revoked").length;
  const revoked = licences.filter((l) => l.status === "Revoked").length;
  const brands = new Set(licences.filter((l) => l.status !== "Pending").map((l) => l.brand)).size;
  const s = profileOf(creator.accountId);

  return (
    <div className="flex flex-col gap-[18px]">
      {notice}
      <ProfileHeader
        label="Your creator profile"
        avatar={<BigAvatar src={faceSrc} alt={s ? (s.synthetic ? `${s.name}: AI-generated face, not a real person` : s.name) : "Your reference photo"} letter={creator.accountId[0] ?? "C"} />}
        eyebrow="Creator profile"
        title={displayName(creator.accountId)}
        subtitle="Brands' agents ask and make the ad; nothing is paid until you approve the finished ad here."
        chips={
          <>
            {creator.active ? <span className={`${CHIP} bg-lime text-ink`}>● Listed</span> : <span className={`${CHIP} bg-black/5 text-ink`}>Paused: no new requests</span>}
            <LikenessChip proven={!!creator.captureSha256} captureSha={creator.captureSha256} />
            <SyntheticBadge accountId={creator.accountId} />
            <a href={accountUrl(CONTRACT_ID)} target="_blank" rel="noreferrer" className={`${CHIP} bg-sky text-ink no-underline hover:underline`} title="Your terms are on the Likeness contract">
              Listed on NEAR ↗
            </a>
            <a href={accountUrl(creator.accountId)} target="_blank" rel="noreferrer" className={`${CHIP} bg-violet-soft text-wait no-underline hover:underline`} title="Brands pay you here, from their escrow on the contract (testnet NEAR)">
              NEAR {creator.accountId} ↗
            </a>
          </>
        }
        note="Testnet demo: your terms, every licence and every receipt are public on NEAR testnet. Your photo is the reference every ad is edited from."
      />
      <SyntheticNote accountId={creator.accountId} />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Your numbers">
        <Stat
          label="Earned (NEAR)"
          value={inbox ? formatNear(inbox.earned) : "—"}
          note={
            <a href={accountUrl(creator.accountId)} target="_blank" rel="noreferrer" className="text-grey-dark underline hover:text-white">
              On the NEAR explorer ↗
            </a>
          }
          accent
        />
        <Stat label="Ads approved" value={inbox ? approvedAds : "—"} />
        <Stat label="Waiting for you" value={inbox ? waiting : "—"} />
        <Stat label="Revoked" value={inbox ? revoked : "—"} />
        <Stat label="Brands" value={inbox ? brands : "—"} note="licensed your face" />
      </section>
      <p className={`m-0 -mt-2 text-[13px] ${MUTED}`}>
        Your numbers are public on NEAR:{" "}
        <a href={accountUrl(creator.accountId)} target="_blank" rel="noreferrer" className="underline hover:text-ink">
          your account ↗
        </a>{" "}
        ·{" "}
        <a href={accountUrl(CONTRACT_ID)} target="_blank" rel="noreferrer" className="underline hover:text-ink">
          the contract ↗
        </a>
      </p>
      {tx}

      <section className="flex flex-col gap-3 rounded-[22px] bg-lime p-5 text-ink sm:p-6" aria-label="Waiting for you">
        <h2 className="m-0 text-[20px] font-bold">Waiting for you{waiting ? ` (${waiting})` : ""}</h2>
        {inbox === null ? (
          <p className="m-0 text-[14px]">Loading…</p>
        ) : waiting ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {requests.map((l) => (
              <li key={`l-${l.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-white px-4 py-3">
                <span className="flex min-w-0 flex-col">
                  <b className="text-[15px]">
                    {l.brand === creator.accountId ? "You (your brand side)" : l.brand} asks for a {USE_LABELS[l.use]} licence
                  </b>
                  <span className="text-[13px] text-grey">
                    {formatNear(l.price)} per render · up to {l.renderCap} renders · licence #{l.id}
                  </span>
                  <span className="flex flex-wrap gap-1.5 pt-1">
                    <SelfLicenceBadge l={l} />
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <button type="button" className={btnClass("ink", "min-h-9")} onClick={() => void act("Approve the licence", calls.approveLicence(l.id))}>
                    Approve
                  </button>
                  <button type="button" className={btnClass("danger", "min-h-9")} onClick={() => void act("Decline the licence", calls.declineLicence(l.id))}>
                    Decline
                  </button>
                </span>
              </li>
            ))}
            {pendingAds.map((it) => (
              <li key={`a-${it.receipt.sha256}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-white px-4 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-[12px] bg-paper">
                    <AdMedia src={it.mediaUrl} mime={it.mime} alt="" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <b className="text-[15px]">
                      {it.licence.brand === creator.accountId ? "You (your brand side)" : it.licence.brand} made {isVideo(it.mime) ? "a video" : "an ad"} with your face
                    </b>
                    <span className="text-[13px] text-grey">
                      {formatNear(it.receipt.amount)} to you on approval · only you can confirm it&apos;s you
                    </span>
                  </span>
                </span>
                <Link href={`/requests/${it.receipt.sha256}`} className={btnClass("ink", "min-h-9")}>
                  Review
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-[16px] bg-white/70 p-4">
            <p className="m-0 text-[15px]">
              <b>No requests yet.</b> Try it yourself: switch to Brand, request an ad of yourself, then come back here to approve it.
            </p>
            <button type="button" onClick={onSwitchToBrand} className={btnClass("ink", "min-h-9")}>
              Switch to Brand
            </button>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-label="Ads made with your face">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="m-0 text-[20px] font-bold text-ink">Ads made with your face</h2>
          {ads.length > 0 && (
            <span className={`text-[13px] ${MUTED}`}>
              {approvedAds} licensed · {revokedAds} revoked
            </span>
          )}
        </div>
        {inbox === null ? (
          <div className={`${SURFACE} h-40 animate-pulse motion-reduce:animate-none`} />
        ) : ads.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ads.map((it) => (
              <AdCard key={it.receipt.sha256} it={it} self={it.licence.brand === creator.accountId} act={act} />
            ))}
          </div>
        ) : (
          <div className={`${SURFACE} flex flex-col gap-1 p-5`}>
            <b className="text-[15px]">No ads yet</b>
            <span className={`text-[14px] ${MUTED}`}>Each ad made under a licence you approved shows here, waiting for your decision.</span>
          </div>
        )}
      </section>


      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className={`${SURFACE} flex flex-col gap-4 p-5 sm:p-6`} aria-label="Your terms">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-[20px] font-bold">Your terms</h2>
            <button type="button" onClick={() => setEditTerms((v) => !v)} className={OUTLINE}>
              {editTerms ? "Close" : "Edit"}
            </button>
          </div>
          {editTerms ? (
            <RulesForm
              initial={creator.terms}
              submitLabel="Update my terms on NEAR"
              onSubmit={async (t) => {
                await act("Update your terms", calls.updateTerms(t));
                setEditTerms(false);
              }}
            />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Rule label="Per render" value={formatNear(creator.terms.pricePerRender)} />
                <Rule label="Longest licence" value={`${creator.terms.maxDays} days`} />
                <Rule label="Render cap" value={String(creator.terms.renderCap)} />
              </div>
              <div className="flex flex-col gap-2">
                <span className={`text-[13px] ${MUTED}`}>You allow</span>
                <div className="flex flex-wrap gap-1.5">
                  {creator.terms.allowedUses.map((u) => (
                    <span key={u} className={`${CHIP} bg-ok-bg text-ink`}>
                      {USE_LABELS[u]}
                    </span>
                  ))}
                </div>
                <span className={`text-[12px] ${MUTED}`}>Political, adult, minors, impersonation and deception are refused for everyone. New terms apply to new requests only.</span>
              </div>
            </>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-[22px] bg-ink p-5 text-white ring-1 ring-white/10 sm:p-6" aria-label="Your public record">
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-lime">Your public record</span>
          <h2 className="m-0 text-[20px] font-bold leading-snug">Anyone can check whether an ad of your face is licensed, straight from the NEAR contract, without trusting Likeness.</h2>
          <div className="flex flex-wrap gap-2">
            <a href="/verifier/index.html" className={btnClass("lime", "min-h-9")}>
              Standalone verifier
            </a>
            <a href={accountUrl(CONTRACT_ID)} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/25 px-4 text-[14px] font-semibold text-white no-underline hover:border-white">
              The contract ↗
            </a>
          </div>
        </section>
      </div>

      {licences.length > 0 && (
        <details className={`${SURFACE} group px-5 py-4`} open={licences.some((l) => l.status === "Active")}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[15px] font-semibold">
            Your licences ({licences.length})
            <span aria-hidden="true" className="transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 pt-3">
            {licences.map((l) => (
              <LicenceRow key={l.id} l={l} act={act} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function LicenceRow({ l, act }: { l: LicenceView; act: Act }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-paper p-3 text-[14px]">
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <b className="truncate">{l.brand}</b>
          <StatusPill kind={LICENCE_PILL[l.status]}>{l.status}</StatusPill>
          <SelfLicenceBadge l={l} />
          {l.tokenId && <span className="text-grey">token #{l.tokenId}</span>}
        </span>
        <span className="text-grey">
          {USE_LABELS[l.use]} · {formatNear(l.price)} per render · {l.rendersUsed}/{l.renderCap} used{l.rendersReserved ? `, ${l.rendersReserved} waiting` : ""} · until {shortDay(l.expiresAt)}
        </span>
      </span>
      {/* Revocable whenever the contract allows it: state Active, even once Exhausted or past its expiry. */}
      {l.state === "Active" && (
        <button type="button" className={btnClass("danger", "min-h-9")} onClick={() => void act("Revoke the licence", calls.revokeLicence(l.id))}>
          Revoke
        </button>
      )}
    </li>
  );
}

function AdCard({ it, self, act }: { it: RenderItem; self: boolean; act: Act }) {
  const r = it.receipt;
  return (
    <article className={`${SURFACE} flex min-w-0 flex-col overflow-hidden`}>
      <div className="relative aspect-square bg-paper">
        <AdMedia src={it.mediaUrl} mime={it.mime} alt={`Ad for ${it.licence.brand}`} />
        <span className={`absolute left-3 top-3 ${CHIP} bg-ink text-lime`} title="AI-edited from the creator's consented photo">
          AI-edited
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <b className="truncate text-[16px]">{self ? "Your brand side" : it.licence.brand}</b>
          <StatusPill kind={AD_PILL[r.status]}>{AD_LABEL[r.status]}</StatusPill>
        </div>
        <span className="flex flex-wrap gap-1.5">
          <SelfLicenceBadge l={it.licence} />
          <SyntheticBadge accountId={it.licence.creator} />
        </span>
        <dl className="m-0 grid grid-cols-3 gap-2 text-[13px]">
          <Fact label={r.status === "Approved" ? "Paid" : "Price"} value={formatNear(r.amount)} />
          <Fact label="Safety" value={it.faceCheck.safety === "passed" ? "passed" : "—"} />
          <Fact label="Licence" value={`#${it.licence.id}`} />
        </dl>
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {r.status === "Reserved" && (
            <Link href={`/requests/${r.sha256}`} className={btnClass("ink", "min-h-9")}>
              Review
            </Link>
          )}
          {r.status === "Approved" && (
            <Link href={`/verify?sha256=${r.sha256}`} className={OUTLINE}>
              Verify
            </Link>
          )}
          {it.decisionTx && (
            <a href={txUrl(it.decisionTx)} target="_blank" rel="noreferrer" className={OUTLINE}>
              Payment ↗
            </a>
          )}
          {r.status === "Approved" && it.licence.state === "Active" && (
            <button type="button" className={btnClass("danger", "min-h-9")} onClick={() => void act("Revoke the licence", calls.revokeLicence(it.licence.id))}>
              Revoke licence
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
