/**
 * Creator rules and the platform's banned uses: the creator's side of every deal. Agents negotiate; only the human
 * consents to their face being used. A request either fits the creator's terms and waits for the creator's own
 * decision, or it never reaches them. The banned uses apply to everyone, on top of any creator's terms.
 *
 * Pure functions only (no I/O), shared by the pages, the API routes and the brand agent. The contract enforces the
 * same limits on-chain; these checks give people a reason in words before anything is signed.
 */

/** What an ad may be for. A creator allows a subset; the contract's `Use` enum has the same names. */
export const USES = ["Fashion", "Beauty", "FoodDrink", "Tech", "Travel", "Fitness", "Finance", "Other"] as const;
export type Use = (typeof USES)[number];
export const USE_LABELS: Record<Use, string> = {
  Fashion: "Fashion",
  Beauty: "Beauty",
  FoodDrink: "Food & drink",
  Tech: "Tech",
  Travel: "Travel",
  Fitness: "Fitness",
  Finance: "Finance & crypto",
  Other: "Other",
};
export const isUse = (v: unknown): v is Use => USES.includes(v as Use);

export const MAX_DAYS_LIMIT = 180;
export const MAX_RENDER_CAP = 1000;
export const BRIEF_MAX = 600;
export const FIELD_MAX = 200;

// ---------------------------------------------------------------- NEAR amounts

const YOCTO_DIGITS = 24;
/** A demo ceiling on a creator's price per render. */
export const MAX_PRICE_YOCTO = 5n * 10n ** 24n;

/** "0.05" (NEAR) → yoctoNEAR as a bigint; null if it isn't a plain positive decimal with ≤ 24 decimals. */
export function parseNear(v: unknown): bigint | null {
  const s = String(v ?? "").trim();
  if (!/^\d{1,9}(\.\d{1,24})?$/.test(s)) return null;
  const [i, f = ""] = s.split(".");
  return BigInt(i!) * 10n ** 24n + BigInt(f.padEnd(YOCTO_DIGITS, "0"));
}

/** yoctoNEAR → "0.05 NEAR", trailing zeros trimmed, at most `dp` decimals (rounded down). */
export function formatNear(yocto: bigint | string, dp = 4): string {
  const y = typeof yocto === "string" ? BigInt(yocto) : yocto;
  const whole = y / 10n ** 24n;
  const frac = (y % 10n ** 24n).toString().padStart(YOCTO_DIGITS, "0").slice(0, dp).replace(/0+$/, "");
  return `${whole}${frac ? `.${frac}` : ""} NEAR`;
}

// ---------------------------------------------------------------- banned uses (keyword layer)

const w = (words: string) => new RegExp(`\\b(?:${words})\\b`, "i");
/**
 * The five uses banned for everyone (political, adult, minors, impersonation, deception), as keyword rules. Always
 * run first; the AI classifier (lib/ai/filter.ts) runs after them and fails closed.
 */
export const BANNED_RULES: { label: string; pattern: RegExp }[] = [
  { label: "Political", pattern: w("election|elections|vote for|voting for|ballot|candidate|campaign rally|political|politician|senator|congress(?:man|woman)?|parliament|prime minister|president(?:ial)?|democrat|republican|party manifesto|referendum|propaganda") },
  { label: "Adult", pattern: w("nude|nudity|naked|topless|nsfw|porn\\w*|sexual|sexy|erotic|explicit|lingerie|fetish|onlyfans|strip(?:per|tease)|undress\\w*") },
  { label: "Anything involving minors", pattern: w("child|children|kid|kids|minor|minors|underage|teen|teenage|teenager|schoolgirl|schoolboy|toddler|baby|infant|preteen|young girl|young boy|\\d{1,2}[- ]?year[- ]?old") },
  { label: "Impersonation", pattern: w("pretend(?:ing)? to be|posing as|impersonat\\w*|official statement from|on behalf of|endorsed by|signature of") },
  { label: "Deception", pattern: w("deepfake|fake news|hoax|scam|fraud\\w*|misinformation|disinformation|fake (?:testimonial|review|evidence|receipt|id|document)|crime scene|mugshot|arrest\\w*|confess\\w*|real footage") },
];

/** Keyword hits for the banned uses, as "Label: \"match\"". */
export function bannedHits(text: string): string[] {
  const hits: string[] = [];
  for (const r of BANNED_RULES) {
    const m = r.pattern.exec(text);
    if (m) hits.push(`${r.label}: "${m[0]}"`);
  }
  return hits;
}

/** The platform's checks on any free text a brand supplies (a brief, a scene, a product). */
export function textProblems(text: string, field = "the brief", max = BRIEF_MAX): string[] {
  const out: string[] = [];
  if (text.trim().length < 3) out.push(`${field} is empty`);
  if (text.length > max) out.push(`${field} is longer than ${max} characters`);
  out.push(...bannedHits(text).map((h) => `banned use in ${field}: ${h}`));
  return out;
}

// ---------------------------------------------------------------- creator terms and a brand's ask

export interface TermsInput {
  pricePerRender: bigint;
  allowedUses: readonly unknown[];
  maxDays: number;
  renderCap: number;
}

/** Validates terms a creator submits; the problem in words, or undefined. */
export function termsProblem(t: TermsInput): string | undefined {
  if (!Array.isArray(t.allowedUses) || t.allowedUses.length === 0) return "allow at least one use";
  if (!t.allowedUses.every(isUse)) return "uses must come from the list";
  if (new Set(t.allowedUses).size !== t.allowedUses.length) return "a use is listed twice";
  if (t.pricePerRender <= 0n || t.pricePerRender > MAX_PRICE_YOCTO) return `the price must be above 0 and at most ${formatNear(MAX_PRICE_YOCTO)} per render`;
  if (!Number.isInteger(t.maxDays) || t.maxDays < 1 || t.maxDays > MAX_DAYS_LIMIT) return `the longest licence is 1 to ${MAX_DAYS_LIMIT} days`;
  if (!Number.isInteger(t.renderCap) || t.renderCap < 1 || t.renderCap > MAX_RENDER_CAP) return `the render cap is 1 to ${MAX_RENDER_CAP}`;
  return undefined;
}

export interface LicenceAsk {
  brief: string;
  use: Use;
  durationDays: number;
  renderCap: number;
}

/**
 * Does a brand's ask fit the creator's terms? Every reason it doesn't, in words a brand understands. An empty list
 * means the request may go to the creator, who still decides.
 */
export function checkAsk(terms: { allowedUses: readonly Use[]; maxDays: number; renderCap: number }, ask: LicenceAsk): string[] {
  const out = textProblems(ask.brief);
  if (!isUse(ask.use)) out.push("unknown use");
  else if (!terms.allowedUses.includes(ask.use)) out.push(`the creator doesn't allow ${USE_LABELS[ask.use]}`);
  if (!Number.isInteger(ask.durationDays) || ask.durationDays < 1) out.push("ask for at least one day");
  else if (ask.durationDays > terms.maxDays) out.push(`${ask.durationDays} days is longer than the creator allows (${terms.maxDays} days)`);
  if (!Number.isInteger(ask.renderCap) || ask.renderCap < 1) out.push("ask for at least one render");
  else if (ask.renderCap > terms.renderCap) out.push(`${ask.renderCap} renders is more than the creator allows (${terms.renderCap})`);
  return out;
}
