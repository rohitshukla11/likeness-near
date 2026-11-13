"use client";

/**
 * The dashboard: connect a NEAR wallet and sign in to Likeness with it (a signed message, no transaction). Every
 * account is a brand (escrow, limits, the agent's key, campaigns). There is no creator sign-up: only the demo's one
 * real creator, the owner (lib/profiles.ts), also has a Creator side (terms, licence requests, ads to approve) and the
 * Creator | Brand switch; licences he grants himself are labelled "Self-licence (demo)" everywhere.
 */
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { btnClass, Card, ErrorCard, Page, Skeleton } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { BrandWorkspace } from "@/components/brand/BrandWorkspace";
import { OwnerRegister } from "@/components/dashboard/OwnerRegister";
import { CreatorHome } from "@/components/likeness/CreatorHome";
import { NotConnectedError } from "@/lib/api";
import { signInToApi } from "@/lib/near/signin";
import { useWallet } from "@/lib/near/wallet";
import { useSessionAccount } from "@/lib/near/session-client";
import { rememberRole, useRole } from "@/components/site/AccountMenu";
import { isOwner } from "@/lib/profiles";

function Dashboard() {
  const w = useWallet();
  const router = useRouter();
  const path = usePathname();
  const chosen = useRole();
  const session = useSessionAccount();
  const [signing, setSigning] = useState<unknown>(null);
  const me = session.me;
  // Who's signed in is our session's answer (a 7-day cookie), not the wallet's: the wallet only signs.
  const account = me?.accountId ?? null;
  const role = isOwner(account) ? chosen : "brand";

  const signIn = async () => {
    setSigning(null);
    try {
      await signInToApi(w.signMessage);
    } catch (e) {
      setSigning(e);
    }
  };
  const signError = signing instanceof NotConnectedError ? <NotConnected what="Sign-in (/api/auth)" /> : signing ? <ErrorCard>{(signing as Error).message}</ErrorCard> : null;

  if (session.loading || !w.ready) return <Skeleton className="h-40" />;
  if (session.error)
    return session.error instanceof NotConnectedError ? <NotConnected what="Your Likeness account (/api/me)" /> : <ErrorCard>{(session.error as Error).message}</ErrorCard>;

  // Not signed in to Likeness yet: connect a wallet (or wait for it to reconnect), then sign the one-time message.
  if (!account) {
    if (!w.accountId)
      return w.restoring ? (
        <Card title="Reconnecting your wallet…">
          <p className="m-0 text-[15px] text-grey">Your wallet was connected before; it&apos;s coming back.</p>
        </Card>
      ) : (
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
    return (
      <Card tone="lime" title="Sign in to Likeness">
        <p className="m-0 text-[15px]">Your wallet signs a one-time message (no transaction, no fee) so Likeness knows this account is yours. You stay signed in for 7 days.</p>
        <button type="button" className={btnClass("ink", "self-start")} onClick={() => void signIn()}>
          Sign in with {w.accountId}
        </button>
        {signError}
      </Card>
    );
  }

  // Signed in. The wallet is needed only to sign: say so when it's missing or a different account.
  const walletNote = !w.accountId ? (
    w.restoring ? (
      <p role="status" className="m-0 rounded-[14px] bg-black/5 px-4 py-2.5 text-[14px] text-grey">
        Reconnecting your wallet… You&apos;re signed in as {account}.
      </p>
    ) : (
      <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] bg-[#FFF1D6] px-4 py-2.5 text-[14px] text-[#7A4B00]">
        <span>Your wallet isn&apos;t connected. You&apos;re still signed in as {account}; reconnect it to sign transactions.</span>
        <button type="button" className={btnClass("ink", "min-h-10")} onClick={() => void w.connect().catch(() => undefined)}>
          Reconnect wallet
        </button>
      </div>
    )
  ) : w.accountId !== account ? (
    <div role="status" className="flex flex-col gap-2 rounded-[14px] bg-[#FFF1D6] px-4 py-3 text-[14px] text-[#7A4B00]">
      <span>
        Your wallet is {w.accountId}, but you&apos;re signed in as {account}. Transactions would be signed by {w.accountId}.
      </span>
      <span className="flex flex-wrap gap-2">
        <button type="button" className={btnClass("ink", "min-h-10")} onClick={() => void signIn()}>
          Sign in as {w.accountId}
        </button>
      </span>
      {signError}
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-[18px]">
      {walletNote}
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
        ) : isOwner(account) ? (
          <OwnerRegister onDone={session.refresh} />
        ) : null
      ) : (
        <BrandWorkspace accountId={account} />
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
