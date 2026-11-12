"use client";

/**
 * The brand side for the connected account: escrow and limits (on-chain, signed in the wallet), the agent's
 * function-call key (add it, list it, delete it), a campaign for the agent, and what the agent did. The same account
 * may also be a creator (one account, both roles, for demos).
 */
import { useCallback, useEffect, useState } from "react";
import { ErrorCard } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { AgentKeyCard } from "./AgentKeyCard";
import { BrandAgentConsole } from "./BrandAgentConsole";
import { CampaignForm } from "./CampaignForm";
import { DepositCard } from "./DepositCard";
import { LimitsCard } from "./LimitsCard";
import { contractConfigured } from "@/lib/near/config";
import { views } from "@/lib/near/view";
import type { BrandView } from "@/lib/types";

export function BrandWorkspace({ accountId }: { accountId: string }) {
  const [brand, setBrand] = useState<BrandView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    if (!contractConfigured()) return;
    let cancelled = false;
    (async () => {
      try {
        const b = await views.getBrand(accountId);
        if (!cancelled) {
          setBrand(b);
          setLoaded(true);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, reload]);

  return (
    <div className="flex flex-col gap-[18px]">
      {!contractConfigured() && <NotConnected what="The Likeness contract (escrow, limits, licences)" />}
      {error && <ErrorCard>{error}</ErrorCard>}
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <DepositCard brand={brand} onChanged={refresh} />
        <LimitsCard key={loaded ? `${brand?.maxPerRender}-${brand?.totalBudget}` : "new"} brand={brand} onChanged={refresh} />
      </div>
      <AgentKeyCard accountId={accountId} />
      <CampaignForm onStarted={refresh} />
      <BrandAgentConsole reload={reload} />
    </div>
  );
}
