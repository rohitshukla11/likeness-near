"use client";

/** The brand's on-chain spending limits: the most per render and a total budget. The contract refuses any ad over them. */
import { useState } from "react";
import { btnClass, Card } from "@/components/ds";
import { Field, inputClass } from "@/components/ui";
import { runTx, TxLine, type TxState } from "@/components/likeness/TxLine";
import { calls } from "@/lib/near/methods";
import { useWallet } from "@/lib/near/wallet";
import { formatNear, parseNear } from "@/lib/rules";
import type { BrandView } from "@/lib/types";

const plain = (y: string) => formatNear(y, 24).replace(" NEAR", "");

export function LimitsCard({ brand, onChanged }: { brand: BrandView | null; onChanged: () => void }) {
  const w = useWallet();
  const [perRender, setPerRender] = useState(brand && brand.maxPerRender !== "0" ? plain(brand.maxPerRender) : "0.1");
  const [budget, setBudget] = useState(brand && brand.totalBudget !== "0" ? plain(brand.totalBudget) : "1");
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const a = parseNear(perRender);
  const b = parseNear(budget);
  const ok = a !== null && b !== null && a > 0n && b >= a;

  return (
    <Card title="Spending limits">
      <p className="m-0 text-[14px] text-grey">
        Enforced by the contract on every ad your agent submits: over the per-render limit, or past the total budget (spent + reserved), it&apos;s refused.
        {brand && ` Now: ${formatNear(brand.maxPerRender)} per render, ${formatNear(brand.totalBudget)} in total.`}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Max per render (NEAR)">
          <input className={inputClass} inputMode="decimal" value={perRender} onChange={(e) => setPerRender(e.target.value.trim())} />
        </Field>
        <Field label="Total budget (NEAR)">
          <input className={inputClass} inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.trim())} />
        </Field>
        <button
          type="button"
          disabled={!ok || tx.kind === "busy"}
          className={btnClass("ink")}
          onClick={async () => {
            if (ok && (await runTx(setTx, "Set limits", () => w.call(calls.setLimits(a!.toString(), b!.toString()))))) onChanged();
          }}
        >
          Save limits
        </button>
      </div>
      {!ok && <p className="m-0 text-[14px] text-wait">The total budget must be at least the per-render limit, and both above 0.</p>}
      <TxLine s={tx} />
    </Card>
  );
}
