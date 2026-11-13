/**
 * One creator as a card: the public face (the owner's photo or a synthetic AI-generated face; anyone else gets an
 * initial) with the niche, the name and a status, the creator's labels, Per render / Renders / Up to facts, a one-line
 * summary of their terms and an optional action. Used by the brand's creator search and the Creators page.
 */
import type { ReactNode } from "react";
import { Initial } from "@/components/ds";
import { CHIP, MUTED, SURFACE } from "./Dash";
import { LikenessChip } from "./Proven";
import { SyntheticBadge } from "./Synthetic";
import { profileOf } from "@/lib/profiles";
import { formatNear, USE_LABELS } from "@/lib/rules";
import type { CreatorView } from "@/lib/types";

export const termsSummary = (c: CreatorView) =>
  `${formatNear(c.terms.pricePerRender)} per render; ${c.terms.allowedUses.map((u) => USE_LABELS[u]).join(", ")}; up to ${c.terms.renderCap} renders over ${c.terms.maxDays} days`;

export function CreatorCard({ c, status, chips, action }: { c: CreatorView; status?: ReactNode; chips?: ReactNode; action?: ReactNode }) {
  const p = profileOf(c.accountId);
  return (
    <li className={`${SURFACE} flex min-w-0 flex-col overflow-hidden`}>
      <div className="relative aspect-[4/3] w-full bg-paper">
        {p ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.card} alt={p.synthetic ? `${p.name}: AI-generated face, not a real person` : p.name} className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center">
            <Initial name={c.accountId} size={72} />
          </span>
        )}
        <span className={`absolute left-3 top-3 ${CHIP} bg-white/90 text-ink`}>{p?.niche ?? "Creator"}</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="min-w-0 truncate text-[17px] leading-snug" title={c.accountId}>
              {p?.name ?? c.accountId}
            </b>
            {status}
          </div>
          <span className="flex flex-wrap gap-1.5">
            {p?.synthetic ? <SyntheticBadge accountId={c.accountId} /> : <LikenessChip proven={!!c.captureSha256} captureSha={c.captureSha256} />}
            {chips}
          </span>
          {p && <span className="text-[13px]">{p.bio}</span>}
        </div>
        <dl className="m-0 grid grid-cols-3 gap-2 text-[13px]">
          <Fact label="Per render" value={formatNear(c.terms.pricePerRender)} />
          <Fact label="Renders" value={`up to ${c.terms.renderCap}`} />
          <Fact label="Up to" value={`${c.terms.maxDays} days`} />
        </dl>
        <span className={`text-[13px] ${MUTED}`}>{termsSummary(c)}</span>
        {action && <div className="mt-auto">{action}</div>}
      </div>
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-paper px-3 py-2">
      <dt className="text-[12px] text-grey">{label}</dt>
      <dd className="tnum m-0 truncate text-[15px] font-bold">{value}</dd>
    </div>
  );
}
