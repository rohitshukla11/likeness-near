"use client";

/**
 * The dashboard, by who is connected: connect a NEAR wallet, sign in to Likeness with it (a signed message, no
 * transaction), then a creator gets onboarding until registered on-chain, and their requests, ads and terms after.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppPage, btnClass, Card, ErrorCard, Skeleton } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { Onboarding } from "@/components/dashboard/Onboarding";
import { CreatorHome } from "@/components/likeness/CreatorHome";
import { api, NotConnectedError } from "@/lib/api";
import { signInToApi } from "@/lib/near/signin";
import { useWallet } from "@/lib/near/wallet";
import type { MeResponse } from "@/lib/types";

type Load = { kind: "loading" } | { kind: "ok"; me: MeResponse } | { kind: "error"; error: unknown };

export default function DashboardPage() {
  const w = useWallet();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [signing, setSigning] = useState<unknown>(null);

  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((n) => n + 1), []);
  useEffect(() => {
    if (!w.accountId) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await api<MeResponse>("/api/me");
        if (!cancelled) setLoad({ kind: "ok", me });
      } catch (error) {
        if (!cancelled) setLoad({ kind: "error", error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [w.accountId, reload]);

  if (!w.ready) return <AppPage title="Dashboard"><Skeleton className="h-40" /></AppPage>;
  if (!w.accountId)
    return (
      <AppPage title="Dashboard" description="Creators license their face here; brands run their agent here.">
        <Card tone="lime" title="Connect your NEAR wallet">
          <p className="m-0 text-[15px]">Testnet only. Your wallet signs every licence, every ad decision and every payment; Likeness never holds your keys.</p>
          <button type="button" className={btnClass("ink", "self-start")} onClick={() => void w.connect().catch(() => undefined)}>
            Connect NEAR wallet
          </button>
        </Card>
      </AppPage>
    );

  const me = load.kind === "ok" ? load.me : null;
  const signedIn = me?.accountId === w.accountId;
  return (
    <AppPage title="Dashboard" description={`Connected as ${w.accountId} (testnet).`}>
      {load.kind === "loading" && <Skeleton className="h-40" />}
      {load.kind === "error" &&
        (load.error instanceof NotConnectedError ? <NotConnected what="Your Likeness account (/api/me)" /> : <ErrorCard>{(load.error as Error).message}</ErrorCard>)}
      {me && !signedIn && (
        <Card tone="lime" title="Sign in to Likeness">
          <p className="m-0 text-[15px]">Your wallet signs a one-time message (no transaction, no fee) so Likeness knows this account is yours.</p>
          <button
            type="button"
            className={btnClass("ink", "self-start")}
            onClick={async () => {
              setSigning(null);
              try {
                await signInToApi(w.signMessage);
                refresh();
              } catch (e) {
                setSigning(e);
              }
            }}
          >
            Sign in with {w.accountId}
          </button>
          {signing instanceof NotConnectedError ? <NotConnected what="Sign-in (/api/auth)" /> : signing ? <ErrorCard>{(signing as Error).message}</ErrorCard> : null}
        </Card>
      )}
      <p className="m-0 text-[14px] text-grey">
        Here for a brand? Your escrow, limits, agent key and campaigns are in the <Link href="/brand">brand workspace</Link>.
      </p>
      {signedIn && me?.creator && <CreatorHome creator={me.creator} />}
      {(signedIn && !me?.creator) || (load.kind === "error" && load.error instanceof NotConnectedError) ? <Onboarding me={me} onDone={refresh} /> : null}
    </AppPage>
  );
}
