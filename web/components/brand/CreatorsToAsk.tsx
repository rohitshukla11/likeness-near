/**
 * The creators the brand's agent can ask, read from the contract, as cards: a
 * face where it may be public (synthetic demo creators) or an initial, the price, the uses, and Pick/Skip against the
 * brand's own per-render limit. The agent's real shortlist (with the brief and use) is in the activity log.
 */
import { CHIP, MUTED, SURFACE } from "@/components/likeness/Dash";
import { LikenessChip } from "@/components/likeness/Proven";
import { CreatorAvatar, SyntheticBadge } from "@/components/likeness/Synthetic";
import { formatNear, USE_LABELS } from "@/lib/rules";
import { syntheticOf } from "@/lib/synthetic";
import type { BrandView, CreatorView } from "@/lib/types";

export function CreatorsToAsk({ creators, brand, self }: { creators: CreatorView[] | null; brand: BrandView | null; self: string }) {
  return (
    <section className="flex flex-col gap-3" aria-label="Creators your agent can ask">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="m-0 text-[20px] font-bold">Creators your agent can ask</h2>
        <span className={`text-[13px] ${MUTED}`}>{brand && brand.maxPerRender !== "0" ? `your limit: ${formatNear(brand.maxPerRender)} per render` : "set your limits to see who fits"}</span>
      </div>
      {creators === null ? (
        <div className={`${SURFACE} h-40 animate-pulse motion-reduce:animate-none`} />
      ) : creators.length === 0 ? (
        <div className={`${SURFACE} p-5 text-[14px] ${MUTED}`}>No creators are registered yet.</div>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {creators.map((c) => {
            const within = !!brand && brand.maxPerRender !== "0" && BigInt(c.terms.pricePerRender) <= BigInt(brand.maxPerRender);
            const pick = c.active && within;
            const reason = !c.active ? "not taking requests" : !brand || brand.maxPerRender === "0" ? "set your limits first" : within ? "within your per-render limit" : "above your per-render limit";
            const s = syntheticOf(c.accountId);
            return (
              <li key={c.accountId} className={`${SURFACE} flex flex-col overflow-hidden ${pick ? "" : "opacity-80"}`}>
                <div className="relative aspect-[4/3] w-full bg-paper">
                  <CreatorAvatar accountId={c.accountId} size="fill" className="absolute inset-0" />
                  <span className={`absolute left-3 top-3 ${CHIP} ${pick ? "bg-lime text-ink" : "bg-white/90 text-ink"}`}>{pick ? "Fits" : "Skip"}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <b className="min-w-0 truncate text-[16px] leading-snug">{s ? s.name : c.accountId}</b>
                    <span className="tnum shrink-0 text-[15px] font-bold">{formatNear(c.terms.pricePerRender)}</span>
                  </div>
                  <span className={`text-[12px] ${MUTED}`}>per render · up to {c.terms.renderCap} · {c.terms.maxDays} days max</span>
                  {s && <span className="text-[13px]">{s.bio}</span>}
                  <span className="flex flex-wrap gap-1.5">
                    <LikenessChip proven={!!c.captureSha256} captureSha={c.captureSha256} />
                    <SyntheticBadge accountId={c.accountId} />
                    {c.accountId === self && <span className={`${CHIP} bg-black/5 text-ink`}>You (a self-licence for demo)</span>}
                  </span>
                  <span className="text-[13px]">{c.terms.allowedUses.map((u) => USE_LABELS[u]).join(" · ")}</span>
                  <span className={`text-[13px] ${pick ? "text-ok" : MUTED}`}>{reason}</span>
                  {!c.captureSha256 && <span className={`text-[12px] ${MUTED}`}>No ad can be made until they prove their likeness.</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
