"use client";

/**
 * /licence/<id>: one licence NFT as the contract shows it. The image is the token's own `media` (an SVG the contract
 * draws on every read: status badge, renders, NEAR paid), next to licence_summary (money and renders, computed on
 * read) and the licence's on-chain history with explorer links. Everything but the history comes straight from the
 * contract; no wallet or sign-in.
 */
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AppPage, Card, ErrorCard, Skeleton, StatusPill, type PillKind } from "@/components/ds";
import { api } from "@/lib/api";
import { accountUrl, CONTRACT_ID, txUrl } from "@/lib/near/config";
import { views, type LicenceSummary, type TokenJson } from "@/lib/near/view";
import { displayName } from "@/lib/profiles";
import { formatNear, USE_LABELS } from "@/lib/rules";
import type { LicenceHistoryItem, LicenceStatus, LicenceView } from "@/lib/types";

const PILL: Record<LicenceStatus, PillKind> = { Pending: "waiting", Declined: "neutral", Active: "licensed", Exhausted: "expired", Expired: "expired", Revoked: "revoked" };
const KIND: Record<LicenceHistoryItem["kind"], string> = { request: "Licence requested by the brand's agent", submit: "Ad submitted for the creator's review", decision: "Creator's decision on an ad" };

interface Loaded {
  licence: LicenceView | null;
  token: TokenJson | null;
  summary: LicenceSummary | null;
}

export default function LicencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const valid = /^\d{1,19}$/.test(id);
  const [data, setData] = useState<Loaded | null>(null);
  const [history, setHistory] = useState<LicenceHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!valid) return;
    let stop = false;
    Promise.all([views.getLicence(id), views.getToken(id), views.getLicenceSummary(id)])
      .then(([licence, token, summary]) => !stop && setData({ licence, token, summary }))
      .catch((e: Error) => !stop && setError(`The contract couldn't be read: ${e.message}`));
    api<{ items: LicenceHistoryItem[] }>(`/api/licences/${id}/history`)
      .then((r) => !stop && setHistory(r.items))
      .catch(() => !stop && setHistory([]));
    return () => {
      stop = true;
    };
  }, [id, valid]);

  const l = data?.licence;
  const s = data?.summary;
  const media = data?.token?.metadata?.media ?? null;

  return (
    <AppPage
      title={`Licence #${id}`}
      description="A licence NFT on NEAR (NEP-171): the image, status and money below are computed by the contract on every read."
    >
      {!valid ? (
        <ErrorCard>A licence id is a number.</ErrorCard>
      ) : error ? (
        <ErrorCard>{error}</ErrorCard>
      ) : !data ? (
        <Skeleton className="h-80" />
      ) : !l ? (
        <ErrorCard>There is no licence #{id} on the contract (or its request was declined, which removes it).</ErrorCard>
      ) : (
        <div className="grid grid-cols-1 items-start gap-[18px] desk:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Card>
            {media ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media} alt={`Licence token #${id}: ${l.status}`} className="w-full rounded-[14px]" />
            ) : (
              <p className="m-0 text-[14px] text-grey">No token yet: it&apos;s minted when the creator approves the licence.</p>
            )}
            <p className="m-0 mt-2 text-[13px] font-semibold">NEP-171 token · non-transferable · image drawn on-chain from live licence state</p>
            {data.token?.metadata?.media_hash && (
              <p className="m-0 mt-2 break-all text-[12px] text-grey">media_hash (base64 sha256 of this SVG): {data.token.metadata.media_hash}</p>
            )}
          </Card>
          <div className="flex min-w-0 flex-col gap-[18px]">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b className="text-[17px]">
                  {displayName(l.creator)} → {displayName(l.brand)} · {USE_LABELS[l.use]}
                </b>
                <StatusPill kind={PILL[l.status]}>{l.status}</StatusPill>
              </div>
              {s && (
                <dl className="m-0 mt-3 grid grid-cols-2 gap-2 text-[14px] sm:grid-cols-3">
                  <Fact label="Price per render" value={formatNear(s.price_per_render)} />
                  <Fact label="Renders used" value={`${s.renders_used} of ${s.render_cap}`} />
                  <Fact label="Waiting for the creator" value={String(s.renders_reserved)} />
                  <Fact label="Paid to the creator" value={formatNear(s.paid_to_creator)} />
                  <Fact label="Reserved now" value={formatNear(s.reserved)} />
                  <Fact label="Back to the brand if it ends now" value={formatNear(s.refundable_on_end)} />
                </dl>
              )}
              <p className="m-0 mt-3 text-[13px] text-grey">
                {l.issuedAt ? `Issued ${new Date(l.issuedAt).toLocaleDateString()}` : "Not issued yet"}
                {l.expiresAt ? ` · expires ${new Date(l.expiresAt).toLocaleDateString()}` : ""} · terms hash <code className="break-all">{l.termsHash}</code>
              </p>
              <p className="m-0 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                <a href={accountUrl(l.creator)} target="_blank" rel="noreferrer" className="underline">
                  Creator ↗
                </a>
                <a href={accountUrl(l.brand)} target="_blank" rel="noreferrer" className="underline">
                  Brand (token owner) ↗
                </a>
                <a href={accountUrl(CONTRACT_ID)} target="_blank" rel="noreferrer" className="underline">
                  Contract ↗
                </a>
                <Link href="/verify" className="underline">
                  Verify an ad →
                </Link>
              </p>
            </Card>
            <Card>
              <h2 className="m-0 text-[17px] font-bold">History</h2>
              {history === null ? (
                <Skeleton className="mt-2 h-16" />
              ) : history.length === 0 ? (
                <p className="m-0 mt-2 text-[14px] text-grey">No transactions recorded by this app for this licence. The contract above is the source of truth.</p>
              ) : (
                <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
                  {history.map((h) => (
                    <li key={`${h.kind}-${h.tx}`} className="flex flex-col gap-0.5 rounded-[12px] bg-paper px-3 py-2 text-[14px]">
                      <span>
                        <b>{KIND[h.kind]}</b> · {new Date(h.at).toLocaleString()}
                      </span>
                      <span className="flex flex-wrap gap-x-3 text-[13px]">
                        <a href={txUrl(h.tx)} target="_blank" rel="noreferrer" className="underline">
                          tx {h.tx.slice(0, 10)}… ↗
                        </a>
                        {h.sha256 && (
                          <Link href={`/verify?sha256=${h.sha256}`} className="underline">
                            verify ad {h.sha256.slice(0, 10)}… →
                          </Link>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
    </AppPage>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[12px] bg-paper px-3 py-2">
      <dt className="text-[12px] text-grey">{label}</dt>
      <dd className="tnum m-0 truncate font-bold">{value}</dd>
    </div>
  );
}
