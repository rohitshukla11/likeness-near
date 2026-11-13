"use client";

/**
 * 2 · Limits, compact: the most per ad and the total budget side by side, with a live "Up to N ads" (budget ÷ max) and
 * a red "Max is above budget" when it is. Saved on-chain (set_limits); the contract refuses any ad over them.
 */
import { useState } from "react";
import { btnClass } from "@/components/ds";
import { runTx, type TxState } from "@/components/likeness/TxLine";
import { calls } from "@/lib/near/methods";
import { useWallet } from "@/lib/near/wallet";
import { formatNear, parseNear } from "@/lib/rules";
import type { BrandView } from "@/lib/types";
import { SetPill, SetUpCard, TxNote } from "./SetUp";

const plain = (y: string) => formatNear(y, 24).replace(" NEAR", "");

export function LimitsCard({ brand, onChanged }: { brand: BrandView | null; onChanged: () => void }) {
  const w = useWallet();
  const set = !!brand && brand.maxPerRender !== "0";
  const [perRender, setPerRender] = useState(set ? plain(brand.maxPerRender) : "0.1");
  const [budget, setBudget] = useState(set ? plain(brand.totalBudget) : "0.5");
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const a = parseNear(perRender);
  const b = parseNear(budget);
  const over = a !== null && b !== null && a > b;
  const ok = a !== null && b !== null && a > 0n && !over;
  const unchanged = set && a?.toString() === brand.maxPerRender && b?.toString() === brand.totalBudget;

  return (
    <SetUpCard n={2} title="Limits" pill={<SetPill ok={set} yes="Set" no="Not set" />}>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold text-grey">Max per ad</span>
          <input className="tnum min-h-11 w-full rounded-[12px] border border-field bg-white px-3 text-[15px]" inputMode="decimal" value={perRender} onChange={(e) => setPerRender(e.target.value.trim())} />
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[12px] font-semibold text-grey">Budget</span>
          <input className="tnum min-h-11 w-full rounded-[12px] border border-field bg-white px-3 text-[15px]" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.trim())} />
        </label>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className={`text-[13px] ${over ? "font-semibold text-bad" : "text-grey"}`}>
          {over ? "Max is above budget" : ok ? `Up to ${(b! / a!).toString()} ${b! / a! === 1n ? "ad" : "ads"}` : "Enter two amounts in NEAR"}
        </span>
        <button
          type="button"
          disabled={!ok || unchanged || tx.kind === "busy"}
          className={btnClass("ink", "min-h-11 px-5")}
          onClick={async () => {
            if (ok && (await runTx(setTx, "Set limits", () => w.call(calls.setLimits(a!.toString(), b!.toString()))))) onChanged();
          }}
        >
          Save
        </button>
      </div>
      <TxNote s={tx} />
    </SetUpCard>
  );
}
