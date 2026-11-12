"use client";

/**
 * A registered creator's dashboard: their terms, licence requests to approve or decline, active licences they can
 * revoke, ads waiting for their decision, and every ad already decided. Every decision is a transaction the creator
 * signs in their own wallet.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { btnClass, Card, EmptyState, ErrorCard, StatCard, StatusPill, type PillKind } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { ReceiptTile } from "./ReceiptTile";
import { RulesForm } from "./RulesForm";
import { runTx, TxLine, type TxState } from "./TxLine";
import { api, NotConnectedError } from "@/lib/api";
import { calls } from "@/lib/near/methods";
import { useWallet } from "@/lib/near/wallet";
import { formatNear, USE_LABELS } from "@/lib/rules";
import type { CreatorInbox, CreatorView, LicenceStatus, LicenceView } from "@/lib/types";

const STATUS_PILL: Record<LicenceStatus, PillKind> = { Pending: "waiting", Declined: "neutral", Active: "licensed", Exhausted: "expired", Expired: "expired", Revoked: "revoked" };
const day = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

export function CreatorHome({ creator }: { creator: CreatorView }) {
  const w = useWallet();
  const [inbox, setInbox] = useState<CreatorInbox | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const [editing, setEditing] = useState(false);

  const [reload, setReload] = useState(0);
  const load = useCallback(() => setReload((n) => n + 1), []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const inbox = await api<CreatorInbox>("/api/creator/inbox");
        if (!cancelled) {
          setInbox(inbox);
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

  const act = async (what: string, c: Parameters<typeof w.call>[0]) => {
    if (await runTx(setTx, what, () => w.call(c))) load();
  };

  const requests = inbox?.licences.filter((l) => l.status === "Pending") ?? [];
  const licences = inbox?.licences.filter((l) => l.status !== "Pending" && l.status !== "Declined") ?? [];

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
        <StatCard label="Price per render" value={formatNear(creator.terms.pricePerRender)} />
        <StatCard label="Earned" value={inbox ? formatNear(inbox.earned) : "—"} />
        <StatCard label="Waiting for you" value={inbox ? String(requests.length + inbox.pending.length) : "—"} />
      </div>
      <TxLine s={tx} />
      {loadError instanceof NotConnectedError ? (
        <NotConnected what="Your requests and ads (/api/creator/inbox)" />
      ) : loadError ? (
        <ErrorCard>{(loadError as Error).message}</ErrorCard>
      ) : null}

      <Card title="Licence requests">
        {!inbox ? null : requests.length === 0 ? (
          <EmptyState title="No requests">When a brand&apos;s agent asks to license your face, it appears here. Nothing is made before you approve.</EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {requests.map((l) => (
              <LicenceRow key={l.id} l={l}>
                <button type="button" className={btnClass("lime")} onClick={() => void act("Approve the licence", calls.approveLicence(l.id))}>
                  Approve
                </button>
                <button type="button" className={btnClass("danger")} onClick={() => void act("Decline the licence", calls.declineLicence(l.id))}>
                  Decline
                </button>
              </LicenceRow>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Ads waiting for your decision">
        {!inbox ? null : inbox.pending.length === 0 ? (
          <EmptyState title="Nothing waiting">Each ad made under your licences waits here until you approve or reject that exact file.</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {inbox.pending.map((it) => (
              <ReceiptTile key={it.receipt.sha256} item={it} href={`/requests/${it.receipt.sha256}`} />
            ))}
          </div>
        )}
      </Card>

      <Card title="Your licences">
        {!inbox ? null : licences.length === 0 ? (
          <EmptyState title="No licences yet" />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {licences.map((l) => (
              <LicenceRow key={l.id} l={l}>
                {l.status === "Active" && (
                  <button type="button" className={btnClass("danger")} onClick={() => void act("Revoke the licence", calls.revokeLicence(l.id))}>
                    Revoke
                  </button>
                )}
              </LicenceRow>
            ))}
          </ul>
        )}
      </Card>

      {inbox && inbox.decided.length > 0 && (
        <Card title="Decided ads">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {inbox.decided.map((it) => (
              <ReceiptTile key={it.receipt.sha256} item={it} href={`/requests/${it.receipt.sha256}`} />
            ))}
          </div>
        </Card>
      )}

      <Card title="Your terms" action={<button type="button" className={btnClass("ghost")} onClick={() => setEditing((e) => !e)}>{editing ? "Close" : "Edit"}</button>}>
        {editing ? (
          <RulesForm initial={creator.terms} submitLabel="Update my terms on NEAR" onSubmit={async (t) => void (await act("Update your terms", calls.updateTerms(t)))} />
        ) : (
          <p className="m-0 text-[15px]">
            {formatNear(creator.terms.pricePerRender)} per render · up to {creator.terms.renderCap} renders per licence · at most {creator.terms.maxDays} days ·{" "}
            {creator.terms.allowedUses.map((u) => USE_LABELS[u]).join(", ")}
          </p>
        )}
        <p className="m-0 text-[13px] text-grey">
          Changes apply to new requests only; each licence keeps the terms it was approved under (its terms hash). <Link href="/how">How consent works</Link>
        </p>
      </Card>
    </div>
  );
}

function LicenceRow({ l, children }: { l: LicenceView; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line p-3 text-[14px]">
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <b className="truncate">{l.brand}</b>
          <StatusPill kind={STATUS_PILL[l.status]}>{l.status}</StatusPill>
          {l.tokenId && <span className="text-grey">token #{l.tokenId}</span>}
        </span>
        <span className="text-grey">
          {USE_LABELS[l.use]} · {formatNear(l.price)} per render · {l.rendersUsed}/{l.renderCap} used{l.rendersReserved ? `, ${l.rendersReserved} waiting` : ""} · until {day(l.expiresAt)}
        </span>
      </span>
      <span className="flex gap-2">{children}</span>
    </li>
  );
}
