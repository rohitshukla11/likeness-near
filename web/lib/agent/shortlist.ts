/**
 * The agent's deterministic filter, before any model: every registered creator who is taking requests is either
 * eligible for this ask (their on-chain terms allow the use, the licence length and the render count, and their
 * price is within the brand's per-render limit) or not eligible with one plain reason. Eligible creators carry the
 * campaign's total (price × renders) and whether it fits what's left of the brand's budget; an over-budget creator
 * can be shown but never requested. Paused creators take no requests (the contract refuses them) and are left out.
 * Works before the brand has set anything up (no record, or no limits yet): no per-render check, nothing left in the
 * budget, so every eligible creator is shown and none can be requested until escrow and limits are set.
 * Pure: the caller reads the chain.
 */
import { checkAsk, formatNear, type LicenceAsk } from "../rules.ts";
import type { BrandView, CreatorView } from "../types";

export interface Candidate {
  creator: CreatorView;
  /** price × renders, in yoctoNEAR. */
  total: string;
  fitsBudget: boolean;
}

export interface Ineligible {
  creator: CreatorView;
  reason: string;
}

/**
 * The creators the app shows anywhere (the Creators page, the agent's shortlist, its "Not eligible" list): only those
 * taking requests. A paused creator stays registered on-chain (the contract has no unregister) and the contract refuses
 * requests to it; the app never lists it.
 */
export const listedCreators = (creators: CreatorView[]) => creators.filter((c) => c.active);

/** Has the brand set its spending limits on-chain? */
export const limitsSet = (b: BrandView | null): b is BrandView => !!b && b.maxPerRender !== "0";

/** What the brand can still commit: the total budget minus spent and reserved, and never more than the free escrow. */
export function budgetLeft(b: BrandView | null): bigint {
  if (!limitsSet(b)) return 0n;
  const byBudget = BigInt(b.totalBudget) - BigInt(b.spent) - BigInt(b.reserved);
  const byEscrow = BigInt(b.escrow) - BigInt(b.reserved);
  const left = byBudget < byEscrow ? byBudget : byEscrow;
  return left > 0n ? left : 0n;
}

/** For a video campaign: who allows video (the creator's own opt-in, default off). */
export interface VideoNeed {
  needed: boolean;
  allows: ReadonlySet<string>;
}

export function filterCreators(creators: CreatorView[], ask: LicenceAsk, brand: BrandView | null, video?: VideoNeed): { eligible: Candidate[]; ineligible: Ineligible[]; left: bigint } {
  const left = budgetLeft(brand);
  const eligible: Candidate[] = [];
  const ineligible: Ineligible[] = [];
  for (const c of listedCreators(creators)) {
    const problems = checkAsk(c.terms, ask);
    if (video?.needed && !video.allows.has(c.accountId)) problems.push("the creator hasn't allowed video");
    if (problems.length) {
      ineligible.push({ creator: c, reason: problems.join("; ") });
      continue;
    }
    if (limitsSet(brand) && BigInt(c.terms.pricePerRender) > BigInt(brand.maxPerRender)) {
      ineligible.push({ creator: c, reason: `${formatNear(c.terms.pricePerRender)} per render is above your limit (${formatNear(brand.maxPerRender)})` });
      continue;
    }
    const total = BigInt(c.terms.pricePerRender) * BigInt(ask.renderCap);
    eligible.push({ creator: c, total: total.toString(), fitsBudget: total <= left });
  }
  // The deterministic order (and the fallback ranking): cheapest first.
  eligible.sort((a, b) => (BigInt(a.creator.terms.pricePerRender) < BigInt(b.creator.terms.pricePerRender) ? -1 : BigInt(a.creator.terms.pricePerRender) > BigInt(b.creator.terms.pricePerRender) ? 1 : 0));
  return { eligible, ineligible, left };
}
