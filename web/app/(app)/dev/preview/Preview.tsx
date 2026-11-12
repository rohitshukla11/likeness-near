"use client";

/**
 * /dev/preview?side=creator|brand&state=empty|demo: the real dashboard views with TEST DATA (lib/preview-fixtures.ts),
 * under a banner saying so. Buttons that would sign or call an API are inert here.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppPage, Card } from "@/components/ds";
import { BrandDashboardView } from "@/components/brand/BrandWorkspace";
import { CampaignForm } from "@/components/brand/CampaignForm";
import { DepositCard } from "@/components/brand/DepositCard";
import { LimitsCard } from "@/components/brand/LimitsCard";
import { CreatorDashboardView } from "@/components/likeness/CreatorHome";
import { brandDemo, brandEmpty, creatorDemo, creatorEmpty, PREVIEW_BRAND } from "@/lib/preview-fixtures";
import { syntheticOf } from "@/lib/synthetic";

const noop = async () => undefined;

export function Preview() {
  const q = useSearchParams();
  const side = q.get("side") === "brand" ? "brand" : "creator";
  const demo = q.get("state") !== "empty";
  const links = (["creator", "brand"] as const).flatMap((s) => (["empty", "demo"] as const).map((st) => ({ s, st, href: `/dev/preview?side=${s}&state=${st}` })));
  return (
    <AppPage title={`Preview: ${side} dashboard (${demo ? "with test data" : "empty"})`}>
      <div role="note" className="rounded-[16px] border-2 border-dashed border-wait bg-wait-bg p-4 text-[14px] text-ink">
        <b>Local preview with TEST DATA.</b> Not real records: nothing here is on-chain, and buttons do nothing. Images are the synthetic demo faces standing in
        for ads. Only available in development.
        <span className="mt-2 flex flex-wrap gap-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="underline">
              {l.s} · {l.st}
            </Link>
          ))}
        </span>
      </div>
      {side === "creator" ? (
        <CreatorDashboardView
          creator={(demo ? creatorDemo : creatorEmpty).creator}
          inbox={(demo ? creatorDemo : creatorEmpty).inbox}
          faceSrc={syntheticOf((demo ? creatorDemo : creatorEmpty).creator.accountId)?.face ?? null}
          act={noop}
          onSwitchToBrand={() => undefined}
        />
      ) : (
        <BrandDashboardView
          accountId={demo ? PREVIEW_BRAND : "demo-new-brand.testnet"}
          brand={demo ? brandDemo.brand : brandEmpty.brand}
          creators={demo ? brandDemo.creators : brandEmpty.creators}
          overview={demo ? brandDemo.overview : brandEmpty.overview}
          campaign={<CampaignForm bare onStarted={() => undefined} />}
          money={
            <>
              <DepositCard brand={demo ? brandDemo.brand : null} onChanged={() => undefined} />
              <LimitsCard brand={demo ? brandDemo.brand : null} onChanged={() => undefined} />
            </>
          }
          agentKey={
            <Card title="Your agent's key">
              <p className="m-0 text-[14px] text-grey">
                {demo
                  ? "A function-call key on demo-brand.testnet: request_licence and submit_render only, 0.25 NEAR gas allowance. (Preview: the real card lists the keys from the chain and offers Add / Delete.)"
                  : "Not added yet. (Preview: the real card shows the agent's public key with an Add button that signs one AddKey in your wallet.)"}
              </p>
            </Card>
          }
          onChanged={() => undefined}
          preview
        />
      )}
    </AppPage>
  );
}
