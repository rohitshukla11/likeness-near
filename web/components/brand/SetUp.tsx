/**
 * "Set up once", as in the PayPal demo: the brand's three one-time steps above the brief, each a numbered card with a
 * status pill (1. Escrow, 2. Spending limits, 3. Agent key). The panel is dark until the brand is ready to request a
 * licence (finding creators works before that), then sits plain on the page.
 */
import type { ReactNode } from "react";
import { SURFACE } from "@/components/likeness/Dash";

export function SetUpPanel({ ready, children }: { ready: boolean; children: ReactNode }) {
  return (
    <section
      id="setup"
      className={`flex min-w-0 scroll-mt-4 flex-col gap-3 ${ready ? "" : "rounded-[22px] bg-ink p-5 text-white sm:p-6"}`}
      aria-label="Set up once"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={`m-0 text-[20px] font-bold ${ready ? "text-ink" : "text-white"}`}>Set up once</h2>
        <span className={`text-[13px] ${ready ? "text-grey" : "text-grey-dark"}`}>
          {ready ? "Ready: your agent can request licences." : "Find creators works now; requesting a licence needs all three."}
        </span>
      </div>
      {children}
    </section>
  );
}

export function SetUpStep({ n, title, pill, children, wide = false }: { n: number; title: string; pill: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`${SURFACE} flex min-w-0 flex-col gap-3 p-5 ${wide ? "lg:col-span-2" : ""}`} aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-[18px] font-bold">
          {n}. {title}
        </h3>
        {pill}
      </div>
      {children}
    </section>
  );
}

/** A small fact tile: label over value. */
export function Tile({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-paper px-3 py-2">
      <dt className="text-[12px] text-grey">{label}</dt>
      <dd className="tnum m-0 truncate text-[15px] font-bold">{value}</dd>
      {note && <span className="text-[11px] text-grey">{note}</span>}
    </div>
  );
}
