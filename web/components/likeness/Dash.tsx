/**
 * Dashboard building blocks shared by the creator and brand dashboards: the profile header, stat tiles,
 * rule tiles and facts. Light surfaces on the paper ground, one ink accent tile per row.
 */
import type { ReactNode } from "react";

export const SURFACE = "rounded-[22px] bg-white text-ink ring-1 ring-black/[0.04]";
export const MUTED = "text-grey";
export const CHIP = "inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold";
export const OUTLINE =
  "inline-flex min-h-9 items-center justify-center rounded-full border border-ink/15 px-4 text-[14px] font-semibold text-ink no-underline transition-colors hover:border-ink";

export function ProfileHeader({ avatar, eyebrow, title, subtitle, chips, note, label }: { avatar: ReactNode; eyebrow: string; title: ReactNode; subtitle: ReactNode; chips?: ReactNode; note?: ReactNode; label: string }) {
  return (
    <section className={`${SURFACE} flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6`} aria-label={label}>
      <div className="flex shrink-0 justify-center sm:block">{avatar}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className={`text-[12px] font-semibold uppercase tracking-[0.08em] ${MUTED}`}>{eyebrow}</span>
          <h1 className="m-0 break-words font-display text-[clamp(24px,4vw,36px)] font-extrabold leading-[1.05] tracking-[-0.01em]">{title}</h1>
          <p className={`m-0 text-[14px] ${MUTED}`}>{subtitle}</p>
        </div>
        {chips && <div className="flex flex-wrap gap-2">{chips}</div>}
        {note && <p className={`m-0 text-[12px] ${MUTED}`}>{note}</p>}
      </div>
    </section>
  );
}

/** A 112 px rounded square: an image, or a letter on ink. */
export function BigAvatar({ src, alt, letter }: { src?: string | null; alt?: string; letter: string }) {
  return (
    <div className="relative h-28 w-28 overflow-hidden rounded-[26px] bg-ink ring-4 ring-lime">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt ?? ""} className="h-full w-full object-cover object-top" />
      ) : (
        <span aria-hidden="true" className="flex h-full w-full items-center justify-center font-display text-[48px] font-extrabold text-lime">
          {letter.toUpperCase()}
        </span>
      )}
    </div>
  );
}

export function Stat({ label, value, note, accent = false }: { label: string; value: ReactNode; note?: ReactNode; accent?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 rounded-[20px] px-4 py-4 ${accent ? "col-span-2 bg-ink text-white md:col-span-1" : SURFACE}`}>
      <span className={`text-[12px] font-semibold uppercase tracking-[0.06em] ${accent ? "text-grey-dark" : MUTED}`}>{label}</span>
      <span className="tnum break-words font-display text-[clamp(22px,3vw,30px)] font-extrabold leading-none">{value}</span>
      {note && <span className={`text-[12px] ${accent ? "text-grey-dark" : MUTED}`}>{note}</span>}
    </div>
  );
}

export function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[16px] bg-paper px-3 py-3">
      <span className={`text-[12px] ${MUTED}`}>{label}</span>
      <span className="tnum text-[17px] font-bold">{value}</span>
    </div>
  );
}

export function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className={`text-[11px] uppercase tracking-[0.06em] ${MUTED}`}>{label}</dt>
      <dd className="m-0 truncate font-semibold">{value}</dd>
    </div>
  );
}

/** A date as "11 Dec 2026", in UTC so the server and the browser render the same text. */
export const shortDay = (ms: number | null | undefined) => (ms ? new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—");
