"use client";

/**
 * Every registered creator, read from the contract (list_creators): their price, the uses they allow, the longest
 * licence and the render cap. No faces here: a creator's capture is never public.
 */
import { useEffect, useState } from "react";
import { AppPage, EmptyState, ErrorCard, Initial, Skeleton, StatusPill } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { accountUrl, contractConfigured } from "@/lib/near/config";
import { views } from "@/lib/near/view";
import { formatNear, USE_LABELS } from "@/lib/rules";
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
    <AppPage title="Creators" description="Everyone who has registered their terms on the Likeness contract. Brands' agents ask; creators decide.">
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
          {creators.map((c) => (
            <li key={c.accountId} className="flex flex-col gap-2 rounded-[20px] bg-white p-4 text-[14px]">
              <span className="flex items-center gap-3">
                <Initial name={c.accountId} size={44} />
                <span className="min-w-0">
                  <a href={accountUrl(c.accountId)} target="_blank" rel="noreferrer" className="block truncate font-semibold">
                    {c.accountId}
                  </a>
                  <StatusPill kind={c.active ? "licensed" : "neutral"}>{c.active ? "Open to requests" : "Paused"}</StatusPill>
                </span>
              </span>
              <span>
                {formatNear(c.terms.pricePerRender)} per render · up to {c.terms.renderCap} renders · {c.terms.maxDays} days max
              </span>
              <span className="text-grey">{c.terms.allowedUses.map((u) => USE_LABELS[u]).join(", ")}</span>
            </li>
          ))}
        </ul>
      )}
    </AppPage>
  );
}
