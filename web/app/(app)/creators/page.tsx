"use client";

/**
 * Every registered creator, read from the contract (list_creators): their price, the uses they allow, the longest
 * licence and the render cap, as cards (components/likeness/CreatorCard). Paused creators aren't listed. The owner's
 * photo (published with his consent) and the synthetic demo creators' AI-generated faces (labelled as such) are shown.
 */
import { useEffect, useState } from "react";
import { AppPage, EmptyState, ErrorCard, Skeleton, StatusPill } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { CreatorCard } from "@/components/likeness/CreatorCard";
import { SyntheticNote } from "@/components/likeness/Synthetic";
import { accountUrl, contractConfigured } from "@/lib/near/config";
import { views } from "@/lib/near/view";
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
      ) : creators.filter((c) => c.active).length === 0 ? (
        <EmptyState title="No creators yet">No creator is taking requests right now.</EmptyState>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {creators
            .filter((c) => c.active)
            .map((c) => (
              <CreatorCard
                key={c.accountId}
                c={c}
                status={<StatusPill kind="licensed">Open to requests</StatusPill>}
                action={
                  <span className="flex flex-col gap-1">
                    <SyntheticNote accountId={c.accountId} />
                    <a href={accountUrl(c.accountId)} target="_blank" rel="noreferrer" className="truncate text-[12px] text-grey">
                      {c.accountId} ↗
                    </a>
                  </span>
                }
              />
            ))}
        </ul>
      )}
    </AppPage>
  );
}
