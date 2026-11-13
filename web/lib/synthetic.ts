/**
 * Synthetic demo creators: AI-generated faces of people who don't exist, so the app can be tried and judged without
 * anyone's real face. Each is an ordinary testnet account registered on the contract (scripts/seed-synthetic.ts), and
 * is labelled as synthetic everywhere it appears. Their faces are our own generated files (provenance in
 * public/synthetic/PROVENANCE.md and docs/HACKATHON.md); they're public because no real person is shown.
 * Decisions for a synthetic creator (approve/decline a licence or an ad) are made by the operator with that account's
 * key, and labelled as such: there is no person to consent.
 */
import type { Use } from "./rules";

export const SYNTHETIC_NOTE = "Synthetic demo creator: AI-generated face, not a real person";
export const SYNTHETIC_DECIDER = "Decisions for synthetic demo creators are made by the Likeness operator (no real person is shown).";

export interface SyntheticCreator {
  accountId: string;
  name: string;
  /** What they'd be known for (the brand's shortlist and the Creators page show it). */
  niche: string;
  /** One line about the (fictional) creator. */
  bio: string;
  /** Public path of the face (also the capture frame stored for edits and the similarity check). */
  face: string;
  /** sha256 of that file = the capture_sha256 registered on-chain. */
  faceSha256: string;
  terms: { pricePerRenderNear: string; allowedUses: Use[]; maxDays: number; renderCap: number };
}

/**
 * The synthetic demo creators beside the one real creator (lib/profiles.ts): Maya from the PayPal demo (name, niche,
 * terms scaled to NEAR) and Asha.
 */
export const SYNTHETIC: SyntheticCreator[] = [
  {
    accountId: "likeness-synth-asha.testnet",
    name: "Asha",
    niche: "Lifestyle & food",
    bio: "Lifestyle and food creator: cafés, home cooking and weekend trips.",
    face: "/synthetic/asha.jpg",
    faceSha256: "e5b69388fda5ca383cc7f3a7d3208e6cbd9cdd8b0cff72903a566a2b5210c642",
    terms: { pricePerRenderNear: "0.04", allowedUses: ["FoodDrink", "Travel", "Fashion", "Beauty"], maxDays: 30, renderCap: 10 },
  },
  {
    accountId: "likeness-synth-maya.testnet",
    name: "Maya Lindqvist",
    niche: "Fitness",
    bio: "Fitness coach: training, activewear and healthy routines.",
    face: "/synthetic/maya.jpg",
    faceSha256: "2be7556bab0363203b32328ec9c6a9d397a430c7cacde06b02fdb8efbdf4b7f0",
    terms: { pricePerRenderNear: "0.05", allowedUses: ["Fitness", "Fashion", "Beauty"], maxDays: 21, renderCap: 8 },
  },
];

const byId = new Map(SYNTHETIC.map((s) => [s.accountId, s]));
export const syntheticOf = (accountId: string | null | undefined) => (accountId ? byId.get(accountId) : undefined);
export const isSynthetic = (accountId: string | null | undefined) => !!syntheticOf(accountId);

/** "Asha (synthetic demo creator)" for synthetic accounts, else the account id. */
export const creatorLabel = (accountId: string) => {
  const s = byId.get(accountId);
  return s ? `${s.name} (synthetic demo creator)` : accountId;
};
