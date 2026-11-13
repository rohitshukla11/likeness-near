/**
 * The agent's shortlist: every registered creator on the contract, each with one plain reason it's a pick or a skip.
 * Only creators whose on-chain terms fit the ask, who are taking requests, and whose price is within the brand's
 * per-render limit are picks. Pure apart from its inputs (the caller reads the chain).
 */
import { checkAsk, formatNear, type LicenceAsk } from "../rules";
import type { BrandView, CreatorView } from "../types";
import { OWNER, isOwner } from "../profiles";
import { syntheticOf } from "../synthetic";

export interface ShortlistEntry {
  creator: CreatorView;
  pick: boolean;
  reason: string;
}

export function shortlist(creators: CreatorView[], ask: LicenceAsk, brand: BrandView): ShortlistEntry[] {
  // Paused creators take no requests (the contract refuses them): left out entirely.
  return creators
    .filter((c) => c.active)
    .map((c) => {
      const problems = checkAsk(c.terms, ask);
      if (problems.length) return { creator: c, pick: false, reason: problems.join("; ") };
      if (BigInt(c.terms.pricePerRender) > BigInt(brand.maxPerRender)) {
        return { creator: c, pick: false, reason: `${formatNear(c.terms.pricePerRender)} per render is above the brand's limit (${formatNear(brand.maxPerRender)})` };
      }
      const synth = syntheticOf(c.accountId);
      const self =
        c.accountId === brand.accountId
          ? "same account as the brand: a self-licence for demo; "
          : synth
            ? `${synth.name} (${synth.niche}), a synthetic demo creator (AI-generated face, not a real person); `
            : isOwner(c.accountId)
              ? `${OWNER.name} (${OWNER.niche}), the demo's real creator; `
              : "";
      const proof = c.captureSha256 ? "" : "; likeness not proven yet, so no ad can be made until they prove it";
      return { creator: c, pick: true, reason: `${self}fits: ${formatNear(c.terms.pricePerRender)} per render, up to ${c.terms.renderCap} renders, ${c.terms.maxDays} days max${proof}` };
    })
    // Picks first; among them, proven creators first (an ad can be made right away); then the cheaper.
    .sort((a, b) => Number(b.pick) - Number(a.pick) || Number(!!b.creator.captureSha256) - Number(!!a.creator.captureSha256) || (BigInt(a.creator.terms.pricePerRender) < BigInt(b.creator.terms.pricePerRender) ? -1 : 1));
}
