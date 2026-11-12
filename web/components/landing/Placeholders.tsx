/**
 * Non-photographic stand-ins for the landing page: initials discs and abstract shape "portraits". No photos, no
 * generated faces, no real people.
 */

export const PALETTES = [
  { bg: "#ECE6FD", a: "#8B5CF6", b: "#121316", c: "#DCF37B" },
  { bg: "#E3EFF9", a: "#25B6D2", b: "#1F4D3A", c: "#FFFFFF" },
  { bg: "#FBE3EC", a: "#C27A92", b: "#121316", c: "#F6D9A8" },
  { bg: "#DCF37B", a: "#4C5230", b: "#121316", c: "#FFFFFF" },
] as const;
export type Palette = (typeof PALETTES)[number];

/** A round disc with initials (decorative). */
export function InitialDisc({ letters, size = 44, palette = PALETTES[0], ring }: { letters: string; size?: number; palette?: Palette; ring?: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-display font-bold"
      style={{ width: size, height: size, background: palette.a, color: palette.c, fontSize: Math.round(size * 0.36), border: ring ? `3px solid ${ring}` : undefined }}
    >
      {letters}
    </span>
  );
}

/** An abstract figure built from shapes: a head disc, shoulders and a few geometric accents. Fills its box. */
export function ShapePortrait({ palette = PALETTES[0], variant = 0, className = "" }: { palette?: Palette; variant?: number; className?: string }) {
  const v = variant % 3;
  return (
    <svg aria-hidden="true" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" className={`h-full w-full ${className}`}>
      <rect width="400" height="500" fill={palette.bg} />
      {v === 0 && <circle cx="320" cy="90" r="70" fill={palette.c} opacity="0.9" />}
      {v === 1 && <rect x="-40" y="40" width="200" height="200" rx="40" fill={palette.c} opacity="0.85" transform="rotate(-12 60 140)" />}
      {v === 2 && <path d="M0 120 C 120 60, 260 180, 400 100 L400 0 L0 0 Z" fill={palette.c} opacity="0.85" />}
      <circle cx="200" cy="205" r="82" fill={palette.a} />
      <path d="M40 500 C 50 360, 120 300, 200 300 S 350 360, 360 500 Z" fill={palette.b} />
      <circle cx="200" cy="205" r="82" fill="none" stroke={palette.c} strokeWidth="6" strokeDasharray="10 14" opacity="0.7" />
    </svg>
  );
}
