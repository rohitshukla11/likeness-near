"use client";

/**
 * The brand's workspace below the campaign form: what its agent did (the activity log, every pick and skip with a
 * reason), the licences it holds (each an on-chain licence token) and the ads it made, each waiting for or decided by
 * its creator. "Agents propose. Only the human consents to their face being used."
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, EmptyState, ErrorCard, StatusPill } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { ReceiptTile } from "@/components/likeness/ReceiptTile";
import { SelfLicenceBadge } from "@/components/likeness/SelfLicence";
import { api, NotConnectedError } from "@/lib/api";
import { txUrl } from "@/lib/near/config";
import { formatNear, USE_LABELS } from "@/lib/rules";
import type { BrandOverview } from "@/lib/types";

export function BrandAgentConsole({ reload }: { reload: number }) {
  const [data, setData] = useState<BrandOverview | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await api<BrandOverview>("/api/brand/overview");
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  if (error instanceof NotConnectedError) return <NotConnected what="Your agent's activity, licences and ads (/api/brand/overview)" />;
  if (error) return <ErrorCard>{(error as Error).message}</ErrorCard>;
  if (!data) return null;
  return (
    <div className="flex flex-col gap-[18px]">
      <Card title="Ads">
        {data.renders.length === 0 ? (
          <EmptyState title="No ads yet">Ads appear here once a creator approves a licence and your agent makes them.</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.renders.map((it) => (
              <ReceiptTile key={it.receipt.sha256} item={it} />
            ))}
          </div>
        )}
      </Card>
      <Card title="Licences (on-chain licence tokens)">
        {data.licences.length === 0 ? (
          <EmptyState title="No licences yet" />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[14px]">
            {data.licences.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-[14px] border border-line p-3">
                <b>{l.creator}</b>
                <StatusPill kind={l.status === "Active" ? "licensed" : l.status === "Pending" ? "waiting" : l.status === "Revoked" ? "revoked" : "expired"}>{l.status}</StatusPill>
                <SelfLicenceBadge l={l} />
                <span className="text-grey">
                  {USE_LABELS[l.use]} · {formatNear(l.price)} · {l.rendersUsed}/{l.renderCap}
                  {l.tokenId ? ` · token #${l.tokenId}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Agent activity">
        {data.activity.length === 0 ? (
          <EmptyState title="Nothing yet">Start a campaign above.</EmptyState>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-2 p-0 text-[14px]">
            {data.activity.map((a, i) => (
              <li key={i} className="flex flex-wrap gap-2">
                <span className="text-grey">{new Date(a.at).toLocaleTimeString()}</span>
                <span className="font-semibold">{a.kind}</span>
                <span className="min-w-0 flex-1">{a.summary}</span>
                {a.sha256 && <Link href={`/verify?sha256=${a.sha256}`}>verify</Link>}
                {a.tx && (
                  <a href={txUrl(a.tx)} target="_blank" rel="noreferrer">
                    tx
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
