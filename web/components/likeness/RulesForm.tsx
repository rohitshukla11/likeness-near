"use client";

/**
 * A creator's terms: price per render (NEAR), the uses they allow, the longest licence and the render cap. There is
 * no creator agent: a request that fits these terms still waits for the creator's own decision, and every ad does too.
 */
import { useState } from "react";
import { btnClass, ErrorCard } from "@/components/ds";
import { Field, inputClass } from "@/components/ui";
import type { TermsArgs } from "@/lib/near/methods";
import { formatNear, MAX_DAYS_LIMIT, MAX_RENDER_CAP, parseNear, termsProblem, USE_LABELS, USES, type Use } from "@/lib/rules";
import type { Terms } from "@/lib/types";

const DEFAULT_USES: Use[] = ["Fashion", "Tech", "Travel", "Fitness"];

export function RulesForm({ initial, submitLabel, onSubmit }: { initial?: Terms | null; submitLabel: string; onSubmit: (t: TermsArgs) => Promise<void> }) {
  const [price, setPrice] = useState(initial ? formatNear(initial.pricePerRender, 24).replace(" NEAR", "") : "0.05");
  const [uses, setUses] = useState<Use[]>(initial?.allowedUses ?? DEFAULT_USES);
  const [maxDays, setMaxDays] = useState(initial?.maxDays ?? 30);
  const [renderCap, setRenderCap] = useState(initial?.renderCap ?? 10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yocto = parseNear(price);
  const problem = yocto === null ? "the price must be a plain NEAR amount, like 0.05" : termsProblem({ pricePerRender: yocto, allowedUses: uses, maxDays, renderCap });
  const toggle = (u: Use) => setUses((x) => (x.includes(u) ? x.filter((y) => y !== u) : [...x, u]));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (problem || yocto === null) return;
        setBusy(true);
        setError(null);
        try {
          await onSubmit({ price_per_render: yocto.toString(), allowed_uses: uses, max_days: maxDays, render_cap: renderCap });
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Price per render (NEAR)" hint="Paid to you from the brand's escrow when you approve an ad">
          <input className={inputClass} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.trim())} />
        </Field>
        <Field label="Longest licence (days)" hint={`1 to ${MAX_DAYS_LIMIT}`}>
          <input className={inputClass} type="number" min={1} max={MAX_DAYS_LIMIT} value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))} />
        </Field>
        <Field label="Render cap per licence" hint={`1 to ${MAX_RENDER_CAP}; rejected ads don't count`}>
          <input className={inputClass} type="number" min={1} max={MAX_RENDER_CAP} value={renderCap} onChange={(e) => setRenderCap(Number(e.target.value))} />
        </Field>
      </div>
      <Field label="Uses you allow" hint="Political, adult, minors, impersonation and deception are refused for everyone, whatever you choose." group>
        <div className="flex flex-wrap gap-2">
          {USES.map((u) => (
            <label key={u} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[14px] ${uses.includes(u) ? "border-ok bg-ok-bg text-ink" : "border-field bg-white"}`}>
              <input type="checkbox" className="h-4 w-4" checked={uses.includes(u)} onChange={() => toggle(u)} />
              {USE_LABELS[u]}
            </label>
          ))}
        </div>
      </Field>
      <p className="m-0 text-[13px] text-grey">A licence request that fits these terms still waits for you, and so does every ad made under it.</p>
      {problem && <p className="m-0 text-[14px] text-wait">{problem}</p>}
      <button type="submit" disabled={busy || !!problem} className={btnClass("lime", "self-start")}>
        {busy ? "Waiting for your wallet…" : submitLabel}
      </button>
      {error && <ErrorCard>{error}</ErrorCard>}
    </form>
  );
}
