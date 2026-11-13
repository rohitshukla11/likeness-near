"use client";

/**
 * The brand's Creators section, as in the PayPal demo: a header with counts, a name search with a Search button and
 * filters (niche, price per render, allowed use, licence). No cards until the brand presses Search (an empty name
 * lists everyone); then the filters update the results in place. Each card shows the brand's licence status with that
 * creator and its action: "Make the next ad" under an active licence with room, "Waiting for … to approve" for a
 * request, or how the agent can ask. Only active creators (taking requests) are listed.
 */
import { useMemo, useState } from "react";
import { btnClass, StatusPill } from "@/components/ds";
import { IconSearch } from "@/components/ds/icons";
import { CHIP, MUTED, SURFACE } from "@/components/likeness/Dash";
import { CreatorCard } from "@/components/likeness/CreatorCard";
import { NOT_PROVEN_NOTE } from "@/components/likeness/Proven";
import { profileOf } from "@/lib/profiles";
import { formatNear, parseNear, USE_LABELS, USES, type Use } from "@/lib/rules";
import type { BrandView, CreatorView, LicenceView } from "@/lib/types";
import { MakeAd } from "./MakeAd";

type Status = "licensed" | "requested" | "not_yet";
type Filter = { q?: string; niche?: string; maxPrice?: string; use?: Use; licence?: Status | "any_not" };

const PRICES = ["0.05", "0.1", "0.5"] as const;
const selectClass = "min-h-11 w-full min-w-0 rounded-[14px] border border-field bg-white px-3 text-[14px] text-ink";
const nicheOf = (c: CreatorView) => profileOf(c.accountId)?.niche ?? "Other";
const nameOf = (c: CreatorView) => profileOf(c.accountId)?.name ?? c.accountId;

export function CreatorBrowse({
  creators,
  licences,
  brand,
  self,
  onChanged,
  preview = false,
}: {
  creators: CreatorView[] | null;
  licences: LicenceView[];
  brand: BrandView | null;
  self: string;
  onChanged: () => void;
  preview?: boolean;
}) {
  const [f, setF] = useState<Filter>({});
  const [draft, setDraft] = useState("");
  const [searched, setSearched] = useState(false);
  const set = (patch: Partial<Filter>) => setF((x) => ({ ...x, ...patch }));

  const active = useMemo(() => (creators ?? []).filter((c) => c.active), [creators]);
  const statusOf = (c: CreatorView): { status: Status; licence?: LicenceView } => {
    const mine = licences.filter((l) => l.creator === c.accountId);
    const live = mine.find((l) => l.status === "Active");
    if (live) return { status: "licensed", licence: live };
    if (mine.some((l) => l.status === "Pending")) return { status: "requested" };
    return { status: "not_yet" };
  };
  const shown = active.filter((c) => {
    const q = f.q?.toLowerCase();
    if (q && !nameOf(c).toLowerCase().includes(q) && !c.accountId.includes(q)) return false;
    if (f.niche && nicheOf(c) !== f.niche) return false;
    if (f.maxPrice && BigInt(c.terms.pricePerRender) > parseNear(f.maxPrice)!) return false;
    if (f.use && !c.terms.allowedUses.includes(f.use)) return false;
    if (f.licence && (f.licence === "any_not" ? statusOf(c).status === "licensed" : statusOf(c).status !== f.licence)) return false;
    return true;
  });
  const niches = [...new Set(active.map(nicheOf))].sort();
  const filtered = Object.values(f).some((v) => v !== undefined && v !== "");
  const licensed = active.filter((c) => statusOf(c).status === "licensed").length;
  const limit = brand && brand.maxPerRender !== "0" ? BigInt(brand.maxPerRender) : null;
  const clear = () => {
    setF({});
    setDraft("");
  };

  return (
    <section id="creators" className="flex scroll-mt-4 flex-col gap-3" aria-label="Creators">
      <div className={`${SURFACE} flex flex-col gap-4 p-5 sm:p-6`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-grey">License a face</span>
            <h2 className="m-0 font-display text-[clamp(22px,3.4vw,30px)] font-extrabold leading-[1.05] tracking-[-0.01em]">Creators</h2>
            <p className="m-0 max-w-[640px] text-[14px] text-grey">
              People who license their face for AI ads on their own terms: a price per render, the uses they allow, and how many renders over how many days.
              Your agent asks them for a licence; ads start once they approve.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`${CHIP} bg-lime text-ink`}>
              {active.length} {active.length === 1 ? "creator" : "creators"}
            </span>
            <span className={`${CHIP} bg-violet-soft text-wait`}>{licensed} licensed</span>
          </div>
        </div>

        <form
          role="search"
          aria-label="Search creators"
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: draft.trim() || undefined });
            setSearched(true);
          }}
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[12px] font-semibold text-grey">Search creators</span>
            <input
              type="search"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (!e.target.value) set({ q: undefined });
              }}
              placeholder="Name, e.g. Maya"
              className={selectClass}
            />
          </label>
          <button type="submit" className={btnClass("lime", "min-h-11 cursor-pointer gap-2 self-stretch px-6 sm:self-end")}>
            <IconSearch size={18} />
            Search
          </button>
        </form>
        <form className="grid grid-cols-2 gap-2 md:grid-cols-4" onSubmit={(e) => e.preventDefault()} aria-label="Filter creators">
          <Select label="Niche" value={f.niche ?? ""} onChange={(v) => set({ niche: v || undefined })} options={[["", "Any niche"], ...niches.map((n) => [n, n] as [string, string])]} />
          <Select
            label="Price per render"
            value={f.maxPrice ?? ""}
            onChange={(v) => set({ maxPrice: v || undefined })}
            options={[["", "Any price"], ...PRICES.map((p) => [p, `Up to ${p} NEAR`] as [string, string])]}
          />
          <Select label="Allowed use" value={f.use ?? ""} onChange={(v) => set({ use: (v || undefined) as Use | undefined })} options={[["", "Any use"], ...USES.map((u) => [u, USE_LABELS[u]] as [string, string])]} />
          <Select
            label="Licence"
            value={f.licence ?? ""}
            onChange={(v) => set({ licence: (v || undefined) as Filter["licence"] })}
            options={[
              ["", "Any"],
              ["licensed", "Licensed"],
              ["requested", "Requested"],
              ["any_not", "Not licensed yet"],
            ]}
          />
        </form>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]" aria-live="polite">
          <span className={MUTED}>
            {creators === null
              ? "Loading creators from the contract…"
              : searched
                ? `Showing ${shown.length} of ${active.length}`
                : `${active.length} ${active.length === 1 ? "creator" : "creators"}: press Search to list ${active.length === 1 ? "it" : "them"} (leave the name empty for all)`}
          </span>
          {searched && filtered && (
            <button type="button" onClick={clear} className="min-h-11 cursor-pointer rounded-full px-3 text-[13px] font-semibold text-ink underline">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {!searched ? null : shown.length ? (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => {
            const { status, licence } = statusOf(c);
            const room = licence && licence.rendersUsed + licence.rendersReserved < licence.renderCap;
            const within = limit !== null && BigInt(c.terms.pricePerRender) <= limit;
            return (
              <CreatorCard
                key={c.accountId}
                c={c}
                status={
                  status === "licensed" ? (
                    <StatusPill kind="licensed">Licensed</StatusPill>
                  ) : status === "requested" ? (
                    <StatusPill kind="waiting">Requested</StatusPill>
                  ) : (
                    <StatusPill kind="neutral">Not yet</StatusPill>
                  )
                }
                chips={c.accountId === self ? <span className={`${CHIP} bg-black/5 text-ink`}>You (a self-licence for demo)</span> : null}
                action={
                  status === "licensed" ? (
                    !c.captureSha256 ? (
                      <span className={`text-[13px] ${MUTED}`}>{NOT_PROVEN_NOTE}</span>
                    ) : room ? (
                      preview ? (
                        <span className={btnClass("ink", "min-h-11")}>Make the next ad</span>
                      ) : (
                        <MakeAd licenceId={licence!.id} onDone={onChanged} />
                      )
                    ) : (
                      <span className={`text-[13px] ${MUTED}`}>This licence&apos;s render cap is used up: brief your agent for a new one.</span>
                    )
                  ) : status === "requested" ? (
                    <span className={`text-[13px] ${MUTED}`}>Waiting for {nameOf(c)} to approve</span>
                  ) : limit === null ? (
                    <span className={`text-[13px] ${MUTED}`}>Set your spending limits below to let your agent ask.</span>
                  ) : within ? (
                    <a href="#brief" className={btnClass("lime", "min-h-11")}>
                      Brief your agent ↑
                    </a>
                  ) : (
                    <span className={`text-[13px] ${MUTED}`}>Above your per-render limit ({formatNear(limit)}).</span>
                  )
                }
              />
            );
          })}
        </ul>
      ) : (
        <section className={`${SURFACE} flex flex-col items-start gap-2 p-5`}>
          <b className="text-[15px]">{active.length ? "No creator matches these filters" : "No creators are taking requests yet"}</b>
          {filtered && (
            <button type="button" onClick={clear} className={btnClass("lime", "min-h-11")}>
              Clear filters
            </button>
          )}
        </section>
      )}
    </section>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[12px] font-semibold text-grey">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
