"use client";

/**
 * 1 · Escrow, compact: the free NEAR (escrow − reserved, from the contract) with what's reserved, a thin
 * spent / reserved / free bar, and one row: amount, Deposit, withdraw. Both are transactions from the brand's wallet.
 */
import { useState } from "react";
import { btnClass } from "@/components/ds";
import { runTx, type TxState } from "@/components/likeness/TxLine";
import { calls } from "@/lib/near/methods";
import { useWallet } from "@/lib/near/wallet";
import { formatNear, parseNear } from "@/lib/rules";
import type { BrandView } from "@/lib/types";
import { SetPill, SetUpCard, TxNote } from "./SetUp";

const n2 = (y: bigint) => (Number(y / 10n ** 18n) / 1e6).toFixed(2);

export function DepositCard({ brand, onChanged }: { brand: BrandView | null; onChanged: () => void }) {
  const w = useWallet();
  const [amount, setAmount] = useState("0.5");
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const y = parseNear(amount);
  const escrow = brand ? BigInt(brand.escrow) : 0n;
  const reserved = brand ? BigInt(brand.reserved) : 0n;
  const spent = brand ? BigInt(brand.spent) : 0n;
  const free = escrow > reserved ? escrow - reserved : 0n;
  const total = spent + reserved + free;
  const pct = (v: bigint) => (total > 0n ? Number((v * 1000n) / total) / 10 : 0);
  const busy = tx.kind === "busy";

  return (
    <SetUpCard n={1} title="Escrow" pill={<SetPill ok={free > 0n} yes="Funded" no="Not funded" />}>
      <div className="flex items-baseline gap-2">
        <span className="tnum font-display text-[26px] font-extrabold leading-none">{n2(free)}</span>
        <span className="text-[13px] text-grey">NEAR free · {n2(reserved)} reserved</span>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-paper" role="img" aria-label={`Spent ${formatNear(spent)}, reserved ${formatNear(reserved)}, free ${formatNear(free)}`}>
        <span className="bg-grey" style={{ width: `${pct(spent)}%` }} />
        <span className="bg-wait" style={{ width: `${pct(reserved)}%` }} />
        <span className="bg-ok" style={{ width: `${pct(free)}%` }} />
      </div>
      <div className="mt-auto flex items-stretch gap-2">
        <label className="flex min-h-11 min-w-0 flex-1 items-center rounded-[12px] border border-field bg-white px-3">
          <span className="sr-only">Amount (NEAR)</span>
          <input className="tnum min-w-0 flex-1 bg-transparent text-[15px] outline-none" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.trim())} />
          <span className="text-[12px] font-semibold text-grey">NEAR</span>
        </label>
        <button
          type="button"
          disabled={!y || busy}
          className={btnClass("ink", "min-h-11 px-4")}
          onClick={async () => {
            if (y && (await runTx(setTx, `Deposit ${formatNear(y)}`, () => w.call(calls.deposit(y.toString()))))) onChanged();
          }}
        >
          Deposit
        </button>
        <button
          type="button"
          disabled={!y || y > free || busy}
          aria-label="Withdraw this amount"
          title="Withdraw this amount (free balance only)"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-field text-[18px] text-ink hover:border-ink disabled:opacity-40"
          onClick={async () => {
            if (y && (await runTx(setTx, `Withdraw ${formatNear(y)}`, () => w.call(calls.withdraw(y.toString()))))) onChanged();
          }}
        >
          ↑
        </button>
      </div>
      <TxNote s={tx} />
    </SetUpCard>
  );
}
