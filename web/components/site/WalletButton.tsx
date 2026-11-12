"use client";

/** Top right of every app page: connect a NEAR wallet (testnet), or the connected account and Disconnect. */
import { useState } from "react";
import { pillClass } from "@/components/ds";
import { useWallet } from "@/lib/near/wallet";

export function WalletButton() {
  const w = useWallet();
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
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="min-w-0 truncate text-[14px] font-semibold text-white" title={`${w.accountId}${w.walletName ? ` · ${w.walletName}` : ""} · testnet`}>
        {w.accountId}
      </span>
      <span className="rounded-full bg-ink-raised px-2 py-0.5 text-[12px] text-grey-dark">testnet</span>
      <button type="button" className={pillClass("ghost", "min-h-9 px-3 text-[13px] text-grey-dark hover:text-white")} onClick={() => void w.disconnect()}>
        Disconnect
      </button>
    </span>
  );
}
