"use client";

/** 2. Spending limits: the most per render and a total budget, on-chain. The contract refuses any ad over them. */
import { useState } from "react";
import { btnClass, StatusPill } from "@/components/ds";
import { inputClass } from "@/components/ui";
import { runTx, TxLine, type TxState } from "@/components/likeness/TxLine";
import { calls } from "@/lib/near/methods";
import { useWallet } from "@/lib/near/wallet";
import { formatNear, parseNear } from "@/lib/rules";
import type { BrandView } from "@/lib/types";
import { SetUpStep, Tile } from "./SetUp";

const plain = (y: string) => formatNear(y, 24).replace(" NEAR", "");

export function LimitsCard({ brand, onChanged }: { brand: BrandView | null; onChanged: () => void }) {
  const w = useWallet();
  const set = !!brand && brand.maxPerRender !== "0";
  const [perRender, setPerRender] = useState(set ? plain(brand.maxPerRender) : "0.1");
  const [budget, setBudget] = useState(set ? plain(brand.totalBudget) : "0.5");
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const a = parseNear(perRender);
  const b = parseNear(budget);
  const ok = a !== null && b !== null && a > 0n && b >= a;

  return (
    <SetUpStep n={2} title="Spending limits" pill={set ? <StatusPill kind="licensed">Set</StatusPill> : <StatusPill kind="lime">Not set</StatusPill>}>
      <p className="m-0 text-[14px]">The contract enforces them on every ad your agent submits: over the per-render limit, or past the total budget, it&apos;s refused.</p>
      {set && (
        <dl className="m-0 grid grid-cols-2 gap-2">
          <Tile label="Per render, at most" value={formatNear(brand.maxPerRender)} />
          <Tile label="Total budget" value={formatNear(brand.totalBudget)} />
        </dl>
      )}
      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold text-grey">Max per render (NEAR)</span>
          <input className={inputClass} inputMode="decimal" value={perRender} onChange={(e) => setPerRender(e.target.value.trim())} />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold text-grey">Total budget (NEAR)</span>
          <input className={inputClass} inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.trim())} />
        </label>
        <button
          type="button"
          disabled={!ok || tx.kind === "busy"}
          className={btnClass("ink")}
          onClick={async () => {
            if (ok && (await runTx(setTx, "Set limits", () => w.call(calls.setLimits(a!.toString(), b!.toString()))))) onChanged();
          }}
        >
          {set ? "Update limits" : "Save limits"}
        </button>
      </div>
      {!ok && <p className="m-0 text-[13px] text-wait">The total budget must be at least the per-render limit, and both above 0.</p>}
      <TxLine s={tx} />
    </SetUpStep>
  );
}
