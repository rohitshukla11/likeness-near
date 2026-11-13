"use client";

/**
 * Every registered creator, read from the contract (list_creators): their price, the uses they allow, the longest
 * licence and the render cap. Real creators' captures are never public (initials only); synthetic demo creators show
 * their AI-generated face, labelled as such.
 */
import { useEffect, useState } from "react";
import { AppPage, EmptyState, ErrorCard, Skeleton, StatusPill } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { CreatorAvatar, SyntheticBadge, SyntheticNote } from "@/components/likeness/Synthetic";
import { accountUrl, contractConfigured } from "@/lib/near/config";
import { views } from "@/lib/near/view";
import { formatNear, USE_LABELS } from "@/lib/rules";
import { syntheticOf } from "@/lib/synthetic";
import type { CreatorView } from "@/lib/types";

export default function CreatorsPage() {
  const [creators, setCreators] = useState<CreatorView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractConfigured()) return;
    let cancelled = false;
    (async () => {
      try {
        const c = await views.listCreators(0, 50);
        if (!cancelled) setCreators(c);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppPage title="Creators" description="Everyone registered on the Likeness contract. Brands' agents ask; creators decide.">
      {!contractConfigured() ? (
        <NotConnected what="The Likeness contract (list_creators)" />
      ) : error ? (
        <ErrorCard>{error}</ErrorCard>
      ) : !creators ? (
        <Skeleton className="h-40" />
      ) : creators.length === 0 ? (
        <EmptyState title="No creators yet">Creators register from the dashboard with their NEAR wallet.</EmptyState>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-[14px] p-0 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((c) => {
            const s = syntheticOf(c.accountId);
            return (
              <li key={c.accountId} className="flex flex-col overflow-hidden rounded-[22px] bg-white text-[14px] ring-1 ring-black/[0.04]">
                <div className="relative aspect-[4/3] w-full bg-paper">
                  <CreatorAvatar accountId={c.accountId} size="fill" className="absolute inset-0" />
                  <span className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                    <StatusPill kind={c.active ? "licensed" : "neutral"}>{c.active ? "Open to requests" : "Paused"}</StatusPill>
                    <SyntheticBadge accountId={c.accountId} />
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <b className="block truncate text-[16px]">{s ? s.name : c.accountId}</b>
                      <a href={accountUrl(c.accountId)} target="_blank" rel="noreferrer" className="block truncate text-[12px] text-grey">
                        {c.accountId} ↗
                      </a>
                    </span>
                    <span className="tnum shrink-0 text-[15px] font-bold">{formatNear(c.terms.pricePerRender)}</span>
                  </div>
                  <span className="text-grey">
                    per render · up to {c.terms.renderCap} renders · {c.terms.maxDays} days max
                  </span>
                  {s && (
                    <span className="text-[13px]">
                      <b>{s.niche}.</b> {s.bio}
                    </span>
                  )}
                  <span className="text-[13px]">{c.terms.allowedUses.map((u) => USE_LABELS[u]).join(", ")}</span>
                  <SyntheticNote accountId={c.accountId} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AppPage>
  );
}
