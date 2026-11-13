"use client";

/**
 * The dashboard: connect a NEAR wallet and sign in to Likeness with it (a signed message, no transaction). Every
 * account is a brand (escrow, limits, the agent's key, campaigns). There is no creator sign-up: only the demo's one
 * real creator, the owner (lib/profiles.ts), also has a Creator side (terms, licence requests, ads to approve) and the
 * Creator | Brand switch; licences he grants himself are labelled "Self-licence (demo)" everywhere.
 */
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { btnClass, Card, ErrorCard, Page, Skeleton } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { BrandWorkspace } from "@/components/brand/BrandWorkspace";
import { OwnerRegister } from "@/components/dashboard/OwnerRegister";
import { CreatorHome } from "@/components/likeness/CreatorHome";
import { api, NotConnectedError } from "@/lib/api";
import { signInToApi } from "@/lib/near/signin";
import { useWallet } from "@/lib/near/wallet";
import { rememberRole, useRole } from "@/components/site/AccountMenu";
import { isOwner } from "@/lib/profiles";
import type { MeResponse } from "@/lib/types";

type Load = { kind: "loading" } | { kind: "ok"; me: MeResponse } | { kind: "error"; error: unknown };

function Dashboard() {
  const w = useWallet();
  const router = useRouter();
  const path = usePathname();
  const chosen = useRole();
  const role = isOwner(w.accountId) ? chosen : "brand";
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

  if (!w.ready) return <Skeleton className="h-40" />;
  if (!w.accountId)
    return (
      <Card tone="lime" title="Connect your NEAR wallet">
        <p className="m-0 text-[15px]">
          Testnet only. Your wallet signs every licence request, deposit and payment; Likeness never holds your keys. You sign in as a brand:
          brief your agent, and it asks the demo&apos;s creators for a licence.
        </p>
        <button type="button" className={btnClass("ink", "self-start")} onClick={() => void w.connect().catch(() => undefined)}>
          Connect NEAR wallet
        </button>
      </Card>
    );

  const me = load.kind === "ok" ? load.me : null;
  const signedIn = me?.accountId === w.accountId;
  return (
    <div className="flex flex-col gap-[18px]">
      {load.kind === "loading" && <Skeleton className="h-24" />}
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
      {signedIn && (
        <>
          {role === "creator" ? (
            me?.creator ? (
              <CreatorHome
                creator={me.creator}
                captureSha={me.capture?.captureSha256 ?? null}
                onSwitchToBrand={() => {
                  rememberRole("brand");
                  router.replace(`${path}?role=brand`);
                }}
              />
            ) : (
              <OwnerRegister onDone={refresh} />
            )
          ) : (
            <BrandWorkspace accountId={w.accountId} />
          )}
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Page>
      <Suspense fallback={<Skeleton className="h-40" />}>
        <Dashboard />
      </Suspense>
    </Page>
  );
}
