/**
 * The agent's shortlist: every registered creator on the contract, each with one plain reason it's a pick or a skip.
 * Only creators whose on-chain terms fit the ask, who are taking requests, and whose price is within the brand's
 * per-render limit are picks. Pure apart from its inputs (the caller reads the chain).
 */
import { checkAsk, formatNear, type LicenceAsk } from "../rules";
import type { BrandView, CreatorView } from "../types";

export interface ShortlistEntry {
  creator: CreatorView;
  pick: boolean;
  reason: string;
}

export function shortlist(creators: CreatorView[], ask: LicenceAsk, brand: BrandView): ShortlistEntry[] {
  return creators
    .map((c) => {
      if (!c.active) return { creator: c, pick: false, reason: "not taking requests" };
      const problems = checkAsk(c.terms, ask);
      if (problems.length) return { creator: c, pick: false, reason: problems.join("; ") };
      if (BigInt(c.terms.pricePerRender) > BigInt(brand.maxPerRender)) {
        return { creator: c, pick: false, reason: `${formatNear(c.terms.pricePerRender)} per render is above the brand's limit (${formatNear(brand.maxPerRender)})` };
      }
      return { creator: c, pick: true, reason: `fits: ${formatNear(c.terms.pricePerRender)} per render, up to ${c.terms.renderCap} renders, ${c.terms.maxDays} days max` };
    })
    .sort((a, b) => Number(b.pick) - Number(a.pick) || (BigInt(a.creator.terms.pricePerRender) < BigInt(b.creator.terms.pricePerRender) ? -1 : 1));
}
