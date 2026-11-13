"use client";

/**
 * 1. Escrow: the brand's escrow on the contract, read straight from the chain (deposited, reserved for ads waiting on
 * creators, spent, free to withdraw). Deposit and withdraw are transactions from the brand's own wallet.
 */
import { useState } from "react";
import { btnClass, StatusPill } from "@/components/ds";
import { inputClass } from "@/components/ui";
import { runTx, TxLine, type TxState } from "@/components/likeness/TxLine";
import { calls } from "@/lib/near/methods";
import { useWallet } from "@/lib/near/wallet";
import { formatNear, parseNear } from "@/lib/rules";
import type { BrandView } from "@/lib/types";
import { SetUpStep, Tile } from "./SetUp";

export function DepositCard({ brand, onChanged }: { brand: BrandView | null; onChanged: () => void }) {
  const w = useWallet();
  const [amount, setAmount] = useState("0.5");
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const y = parseNear(amount);
  const free = brand ? BigInt(brand.escrow) - BigInt(brand.reserved) : 0n;

  return (
    <SetUpStep n={1} title="Escrow" pill={free > 0n ? <StatusPill kind="licensed">Funded</StatusPill> : <StatusPill kind="lime">Not funded</StatusPill>}>
      <p className="m-0 text-[14px]">Deposit testnet NEAR once. Each ad your creators approve is paid from it; until then its price is only reserved.</p>
      <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Deposited" value={brand ? formatNear(brand.escrow) : "—"} />
        <Tile label="Reserved" value={brand ? formatNear(brand.reserved) : "—"} />
        <Tile label="Spent" value={brand ? formatNear(brand.spent) : "—"} />
        <Tile label="Free" value={brand ? formatNear(free) : "—"} />
      </dl>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[12px] font-semibold text-grey">Amount (NEAR)</span>
          <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.trim())} />
        </label>
        <button
          type="button"
          disabled={!y || tx.kind === "busy"}
          className={btnClass("ink")}
          onClick={async () => {
            if (y && (await runTx(setTx, `Deposit ${formatNear(y)}`, () => w.call(calls.deposit(y.toString()))))) onChanged();
          }}
        >
          Deposit
        </button>
        <button
          type="button"
          disabled={!y || y > free || tx.kind === "busy"}
          className={btnClass("outline")}
          onClick={async () => {
            if (y && (await runTx(setTx, `Withdraw ${formatNear(y)}`, () => w.call(calls.withdraw(y.toString()))))) onChanged();
          }}
        >
          Withdraw
        </button>
      </div>
      <TxLine s={tx} />
      <span className="text-[12px] text-grey">Storage for each licence request and ad comes from this escrow too. Only the free balance can be withdrawn.</span>
    </SetUpStep>
  );
}
