"use client";

/**
 * The brand's escrow on the contract, read straight from the chain: deposited, reserved for ads waiting on creators,
 * spent, and what's free to withdraw. Deposit and withdraw are transactions from the brand's own wallet.
 */
import { useState } from "react";
import { btnClass, Card, StatCard } from "@/components/ds";
import { Field, inputClass } from "@/components/ui";
import { runTx, TxLine, type TxState } from "@/components/likeness/TxLine";
import { calls } from "@/lib/near/methods";
import { useWallet } from "@/lib/near/wallet";
import { formatNear, parseNear } from "@/lib/rules";
import type { BrandView } from "@/lib/types";

export function DepositCard({ brand, onChanged }: { brand: BrandView | null; onChanged: () => void }) {
  const w = useWallet();
  const [amount, setAmount] = useState("1");
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const y = parseNear(amount);
  const free = brand ? BigInt(brand.escrow) - BigInt(brand.reserved) : 0n;

  return (
    <Card title="Escrow">
      <div className="grid grid-cols-2 gap-[10px] sm:grid-cols-4">
        <StatCard label="Deposited" value={brand ? formatNear(brand.escrow) : "—"} />
        <StatCard label="Reserved" value={brand ? formatNear(brand.reserved) : "—"} note="ads waiting for creators" />
        <StatCard label="Spent" value={brand ? formatNear(brand.spent) : "—"} />
        <StatCard label="Free" value={brand ? formatNear(free) : "—"} note="withdrawable" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Amount (NEAR)">
          <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.trim())} />
        </Field>
        <button
          type="button"
          disabled={!y || tx.kind === "busy"}
          className={btnClass("lime")}
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
      <p className="m-0 text-[13px] text-grey">
        Storage for each licence request and each ad is paid from this escrow too (the agent&apos;s key can&apos;t attach deposits). Only the free
        balance can be withdrawn.
      </p>
      <TxLine s={tx} />
    </Card>
  );
}
