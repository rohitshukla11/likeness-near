"use client";

/**
 * The brand workspace: escrow and limits (on-chain, signed in the brand's wallet), the agent's function-call key
 * (add it, list it, delete it), a campaign for the agent, and what the agent did.
 */
import { useCallback, useEffect, useState } from "react";
import { AppPage, btnClass, Card, ErrorCard } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { AgentKeyCard } from "@/components/brand/AgentKeyCard";
import { BrandAgentConsole } from "@/components/brand/BrandAgentConsole";
import { CampaignForm } from "@/components/brand/CampaignForm";
import { DepositCard } from "@/components/brand/DepositCard";
import { LimitsCard } from "@/components/brand/LimitsCard";
import { contractConfigured } from "@/lib/near/config";
import { views } from "@/lib/near/view";
import { useWallet } from "@/lib/near/wallet";
import type { BrandView } from "@/lib/types";

export default function BrandPage() {
  const w = useWallet();
  const [brand, setBrand] = useState<BrandView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    if (!w.accountId || !contractConfigured()) return;
    let cancelled = false;
    (async () => {
      try {
        const b = await views.getBrand(w.accountId!);
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
  }, [w.accountId, reload]);

  if (!w.accountId)
    return (
      <AppPage title="Brand workspace">
        <Card tone="lime" title="Connect the brand's NEAR wallet">
          <p className="m-0 text-[15px]">Testnet only. Your wallet funds the escrow, sets the limits and adds (or deletes) your agent&apos;s key.</p>
          <button type="button" className={btnClass("ink", "self-start")} onClick={() => void w.connect().catch(() => undefined)}>
            Connect NEAR wallet
          </button>
        </Card>
      </AppPage>
    );

  return (
    <AppPage title="Brand workspace" description={`${w.accountId} (testnet). Your agent proposes; creators decide.`}>
      {!contractConfigured() && <NotConnected what="The Likeness contract (escrow, limits, licences)" />}
      {error && <ErrorCard>{error}</ErrorCard>}
      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
        <DepositCard brand={brand} onChanged={refresh} />
        <LimitsCard key={loaded ? `${brand?.maxPerRender}-${brand?.totalBudget}` : "new"} brand={brand} onChanged={refresh} />
      </div>
      <AgentKeyCard accountId={w.accountId} />
      <CampaignForm onStarted={refresh} />
      <BrandAgentConsole reload={reload} />
    </AppPage>
  );
}
