"use client";

/**
 * The brand dashboard: who the brand is and its limits, its numbers, a brief for its
 * agent, the creators the agent can ask, its licences and ads beside the agent's activity log, and the money and keys
 * (escrow, limits, the agent's function-call key). The same account may also be a creator (one account, both roles).
 * `BrandWorkspace` loads the data; `BrandDashboardView` only renders it (the local preview reuses it with test data).
 */
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ErrorCard } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { BigAvatar, CHIP, ProfileHeader, Stat } from "@/components/likeness/Dash";
import { AgentKeyCard } from "./AgentKeyCard";
import { AgentActivity, BrandAds, BrandLicences } from "./BrandAgentConsole";
import { AgentFlow } from "./AgentFlow";
import { SetUpPanel } from "./SetUp";
import { DepositCard } from "./DepositCard";
import { LimitsCard } from "./LimitsCard";
import { api, NotConnectedError } from "@/lib/api";
import { accountUrl, CONTRACT_ID, contractConfigured } from "@/lib/near/config";
import { views } from "@/lib/near/view";
import { listedCreators } from "@/lib/agent/shortlist";
import { formatNear } from "@/lib/rules";
import type { BrandOverview, BrandView, CreatorView } from "@/lib/types";

export function BrandWorkspace({ accountId }: { accountId: string }) {
  const [brand, setBrand] = useState<BrandView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [creators, setCreators] = useState<CreatorView[] | null>(null);
  const [overview, setOverview] = useState<BrandOverview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reload, setReload] = useState(0);
  const [keyOn, setKeyOn] = useState(false);
  const refresh = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    if (!contractConfigured()) return;
    let cancelled = false;
    (async () => {
      const [b, c, o] = await Promise.allSettled([views.getBrand(accountId), views.listCreators(0, 50), api<BrandOverview>("/api/brand/overview")]);
      if (cancelled) return;
      if (b.status === "fulfilled") {
        setBrand(b.value);
        setLoaded(true);
      }
      if (c.status === "fulfilled") setCreators(listedCreators(c.value));
      if (o.status === "fulfilled") setOverview(o.value);
      setError(b.status === "rejected" ? b.reason : o.status === "rejected" ? o.reason : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, reload]);

  return (
    <BrandDashboardView
      accountId={accountId}
      brand={brand}
      creators={creators}
      overview={overview}
      notice={
        !contractConfigured() ? (
          <NotConnected what="The Likeness contract (escrow, limits, licences)" />
        ) : error instanceof NotConnectedError ? (
          <NotConnected what="Your agent's licences, ads and activity (/api/brand/overview)" />
        ) : error ? (
          <ErrorCard>{(error as Error).message}</ErrorCard>
        ) : null
      }
      campaign={<AgentFlow onChanged={refresh} />}
      money={
        <>
          <DepositCard brand={brand} onChanged={refresh} />
          <LimitsCard key={loaded ? `${brand?.maxPerRender}-${brand?.totalBudget}` : "new"} brand={brand} onChanged={refresh} />
        </>
      }
      agentKey={<AgentKeyCard accountId={accountId} onStatus={setKeyOn} />}
      keyOn={keyOn}
      onChanged={refresh}
    />
  );
}

export function BrandDashboardView({
  accountId,
  brand,
  creators,
  overview,
  notice,
  campaign,
  money,
  agentKey,
  keyOn = false,
  onChanged,
  preview = false,
}: {
  accountId: string;
  brand: BrandView | null;
  creators: CreatorView[] | null;
  overview: BrandOverview | null;
  notice?: ReactNode;
  campaign: ReactNode;
  money: ReactNode;
  agentKey: ReactNode;
  /** The agent's key is on the brand's account (from the key card). */
  keyOn?: boolean;
  onChanged: () => void;
  preview?: boolean;
}) {
  const free = brand ? BigInt(brand.escrow) - BigInt(brand.reserved) : null;
  const licences = overview?.licences ?? [];
  const renders = overview?.renders ?? [];
  return (
    <div className="flex flex-col gap-[18px]">
      {notice}
      <ProfileHeader
        label="Your brand workspace"
        avatar={<BigAvatar letter={accountId[0] ?? "B"} />}
        eyebrow="Brand workspace"
        title={accountId}
        subtitle="Your agent picks creators whose terms fit, asks for a licence and makes the ad. Each creator approves the licence and every ad in their own wallet before anything is paid."
        chips={
          <>
            <span className={`${CHIP} bg-violet-soft text-wait`} title="Your escrow on the contract, minus what's reserved for ads waiting on creators">
              Escrow free: {free === null ? "—" : formatNear(free)}
            </span>
            {brand && brand.maxPerRender !== "0" ? (
              <span className={`${CHIP} bg-sky text-ink`} title="The contract refuses any ad over these limits">
                Up to {formatNear(brand.maxPerRender)} per render · budget {formatNear(brand.totalBudget)}
              </span>
            ) : (
              <span className={`${CHIP} bg-black/5 text-ink`}>No limits set yet</span>
            )}
            <a href={accountUrl(CONTRACT_ID)} target="_blank" rel="noreferrer" className={`${CHIP} bg-black/5 text-ink no-underline hover:underline`}>
              The contract ↗
            </a>
            <Link href="/creators" className={`${CHIP} bg-black/5 text-ink no-underline hover:underline`}>
              See every creator →
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Your numbers">
        <Stat label="Spent" value={brand ? formatNear(brand.spent) : "—"} note="renders and storage, testnet NEAR" accent />
        <Stat label="Escrow free" value={free === null ? "—" : formatNear(free)} />
        <Stat label="Reserved" value={brand ? formatNear(brand.reserved) : "—"} note="waiting on creators" />
        <Stat label="Licences" value={overview ? licences.length : "—"} />
        <Stat label="Ads approved" value={overview ? renders.filter((r) => r.receipt.status === "Approved").length : "—"} />
      </section>

      <SetUpPanel ready={!!brand && BigInt(brand.escrow) > BigInt(brand.reserved) && brand.maxPerRender !== "0" && keyOn}>
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
          {money}
          {agentKey}
        </div>
      </SetUpPanel>

      {campaign}

      <div className="grid grid-cols-1 items-start gap-[18px] desk:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <BrandLicences licences={licences} creators={creators} onChanged={onChanged} preview={preview} />
          <BrandAds renders={renders} />
        </div>
        <AgentActivity events={overview?.activity ?? []} />
      </div>

    </div>
  );
}
