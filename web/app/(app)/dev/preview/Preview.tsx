"use client";

/**
 * /dev/preview?side=creator|brand&state=empty|demo: the real dashboard views with TEST DATA (lib/preview-fixtures.ts),
 * under a banner saying so. Buttons that would sign or call an API are inert here.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TeeLine, TeePanel } from "@/components/likeness/TeePanel";
import { AppPage } from "@/components/ds";
import { BrandDashboardView } from "@/components/brand/BrandWorkspace";
import { AgentFlow } from "@/components/brand/AgentFlow";
import { DepositCard } from "@/components/brand/DepositCard";
import { CopyButton, SetPill, SetUpCard } from "@/components/brand/SetUp";
import { LimitsCard } from "@/components/brand/LimitsCard";
import { CreatorDashboardView } from "@/components/likeness/CreatorHome";
import { AccountMenuView } from "@/components/site/AccountMenu";
import { brandDemo, brandEmpty, creatorDemo, creatorEmpty, findDemo, PREVIEW_BRAND } from "@/lib/preview-fixtures";
import { profileOf } from "@/lib/profiles";

const noop = async () => undefined;

export function Preview() {
  const q = useSearchParams();
  const side = q.get("side") === "brand" ? "brand" : "creator";
  const demo = q.get("state") !== "empty";
  const links = (["creator", "brand"] as const).flatMap((s) => (["empty", "demo"] as const).map((st) => ({ s, st, href: `/dev/preview?side=${s}&state=${st}` })));
  return (
    <AppPage title={`Preview: ${side} dashboard (${demo ? "with test data" : "empty"})`}>
      <div role="note" className="rounded-[16px] border-2 border-dashed border-wait bg-wait-bg p-4 text-[14px] text-ink">
        <b>Local preview with TEST DATA.</b> Not real records: nothing here is on-chain, and buttons do nothing. Images are the creators&apos; reference photos standing
        in for ads. Only available in development.
        <span className="mt-3 flex flex-wrap items-center justify-end gap-3 rounded-[14px] bg-ink px-4 py-3">
          <span className="mr-auto text-[12px] text-grey-dark">Header when signed in (test account):</span>
          <AccountMenuView accountId={side === "brand" ? PREVIEW_BRAND : (demo ? creatorDemo : creatorEmpty).creator.accountId} role={side} canSwitch={side === "creator"} onRole={() => undefined} onSignOut={() => undefined} />
        </span>
        <span className="mt-2 flex flex-wrap gap-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="underline">
              {l.s} · {l.st}
            </Link>
          ))}
        </span>
      </div>
      {q.get("tee") === "1" && (
        <section className="flex flex-col gap-3 rounded-[20px] bg-white p-5" aria-label="TEE panels (test data)">
          <b>Review page TEE panel (test data): a verified ad, then one whose GPU check failed</b>
          <TeePanel tee={creatorDemo.inbox.pending[0]?.tee} video={false} />
          <TeePanel tee={creatorDemo.inbox.decided[0]?.tee ?? { image: null, screen: null }} video={false} />
          <b>Verify line (test data): verified image, unverified image, no record, video</b>
          <TeeLine kind="image" image={creatorDemo.inbox.pending[0]?.tee.image ?? null} screen={creatorDemo.inbox.pending[0]?.tee.screen ?? null} />
          <TeeLine kind="image" image={creatorDemo.inbox.decided[0]?.tee.image ?? null} screen={creatorDemo.inbox.decided[0]?.tee.screen ?? null} />
          <TeeLine kind="image" image={null} screen={null} />
          <TeeLine kind="video" image={null} screen={null} />
        </section>
      )}
      {side === "creator" ? (
        <CreatorDashboardView
          creator={(demo ? creatorDemo : creatorEmpty).creator}
          inbox={(demo ? creatorDemo : creatorEmpty).inbox}
          faceSrc={profileOf((demo ? creatorDemo : creatorEmpty).creator.accountId)?.face ?? null}
          act={noop}
          onSwitchToBrand={() => undefined}
        />
      ) : (
        <BrandDashboardView
          accountId={demo ? PREVIEW_BRAND : "demo-new-brand.testnet"}
          brand={demo ? brandDemo.brand : brandEmpty.brand}
          creators={demo ? brandDemo.creators : brandEmpty.creators}
          overview={demo ? brandDemo.overview : brandEmpty.overview}
          campaign={<AgentFlow onChanged={() => undefined} preview={{ find: demo ? findDemo : null, renders: 3 }} />}
          money={
            <>
              <DepositCard brand={demo ? brandDemo.brand : null} onChanged={() => undefined} />
              <LimitsCard brand={demo ? brandDemo.brand : null} onChanged={() => undefined} />
            </>
          }
          agentKey={
            <SetUpCard n={3} title="Agent key" pill={<SetPill ok={demo} yes="Active" no="Not added" />}>
              <div className="flex items-center justify-between gap-2">
                <code className="min-w-0 truncate text-[13px]">ed25519:PreviewK…NotReal1</code>
                <CopyButton text="ed25519:PreviewKeyNotReal" label="Copy the agent's public key" />
              </div>
              <p className="m-0 text-[13px] text-grey">Can request and submit · can&apos;t move NEAR (preview: buttons are inert)</p>
            </SetUpCard>
          }
          keyOn={demo}
          onChanged={() => undefined}
          preview
        />
      )}
    </AppPage>
  );
}
