"use client";

/**
 * Top right of every app page: connect a NEAR wallet (testnet), or, once connected, the account, which side of it you're
 * on (Creator profile / Brand workspace), a Creator | Brand switch, and Sign out. One account is both a creator and a
 * brand; the switch only changes which dashboard you see. The last side is remembered in this browser only.
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { pillClass } from "@/components/ds";
import { signOutOfApi } from "@/lib/near/signin";
import { useWallet } from "@/lib/near/wallet";

export type Role = "creator" | "brand";
const KEY = "likeness:role";
const listeners = new Set<() => void>();
const readStored = (): Role => {
  try {
    return localStorage.getItem(KEY) === "brand" ? "brand" : "creator";
  } catch {
    return "creator";
  }
};
export function rememberRole(r: Role) {
  try {
    localStorage.setItem(KEY, r);
  } catch {
    // storage blocked: the URL still carries the role on the dashboard
  }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The side shown: the dashboard's URL decides there (and /brand is the brand side); elsewhere, the last one chosen. */
export function useRole(): Role {
  const path = usePathname();
  const q = useSearchParams();
  const stored = useSyncExternalStore(subscribe, readStored, () => "creator" as Role);
  if (path === "/dashboard") return q.get("role") === "brand" ? "brand" : "creator";
  if (path === "/brand") return "brand";
  return stored;
}

export function AccountMenu() {
  const w = useWallet();
  const router = useRouter();
  const role = useRole();
  const [busy, setBusy] = useState(false);

  if (!w.ready) return <span className="text-[14px] text-grey-dark">Loading wallets…</span>;
  if (!w.accountId)
    return (
      <span className="flex items-center gap-3">
        {w.error && <span className="text-[13px] text-coral">{w.error}</span>}
        <button
          type="button"
          disabled={busy}
          className={pillClass("lime", "px-5 text-[14px]")}
          onClick={async () => {
            setBusy(true);
            try {
              await w.connect();
            } catch {
              // closing the selector is not an error
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Connecting…" : "Connect NEAR wallet"}
        </button>
      </span>
    );

  const go = (r: Role) => {
    rememberRole(r);
    router.push(r === "brand" ? "/dashboard?role=brand" : "/dashboard");
  };

  return (
    <AccountMenuView
      accountId={w.accountId}
      walletName={w.walletName}
      role={role}
      busy={busy}
      onRole={go}
      onSignOut={async () => {
        setBusy(true);
        await signOutOfApi().catch(() => undefined);
        await w.disconnect().catch(() => undefined);
        setBusy(false);
        router.push("/");
      }}
    />
  );
}

/** The signed-in header block on its own (the local preview renders it with a test account). */
export function AccountMenuView({ accountId, walletName, role, busy = false, onRole, onSignOut }: { accountId: string; walletName?: string | null; role: Role; busy?: boolean; onRole: (r: Role) => void; onSignOut: () => void }) {
  const w = { accountId, walletName };
  const go = onRole;
  return (
    <span className="flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-2">
      <span className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime font-display text-[16px] font-extrabold text-ink">
          {w.accountId[0]!.toUpperCase()}
        </span>
        <span className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="max-w-[180px] truncate text-[15px] font-semibold text-white" title={`${w.accountId} (testnet${w.walletName ? `, ${w.walletName}` : ""})`}>
            {w.accountId}
          </span>
          <span className="text-[13px] text-grey-dark">{role === "brand" ? "Brand workspace" : "Creator profile"}</span>
        </span>
      </span>
      <span role="tablist" aria-label="Which side of this account" className="inline-flex rounded-full bg-ink-raised p-1">
        {(["creator", "brand"] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="tab"
            aria-selected={role === r}
            onClick={() => go(r)}
            className={`min-h-9 rounded-full px-4 text-[14px] font-semibold transition-colors ${role === r ? "bg-lime text-ink" : "text-grey-dark hover:text-white"}`}
          >
            {r === "creator" ? "Creator" : "Brand"}
          </button>
        ))}
      </span>
      <button
        type="button"
        disabled={busy}
        className="min-h-9 text-[15px] font-semibold text-grey-dark hover:text-white"
        onClick={onSignOut}
      >
        Sign out
      </button>
    </span>
  );
}
