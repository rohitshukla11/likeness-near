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
  /** Public path of the face (also the capture frame stored for edits and the similarity check). */
  face: string;
  /** sha256 of that file = the capture_sha256 registered on-chain. */
  faceSha256: string;
  terms: { pricePerRenderNear: string; allowedUses: Use[]; maxDays: number; renderCap: number };
}

export const SYNTHETIC: SyntheticCreator[] = [
  {
    accountId: "likeness-synth-asha.testnet",
    name: "Asha",
    face: "/synthetic/asha.jpg",
    faceSha256: "e5b69388fda5ca383cc7f3a7d3208e6cbd9cdd8b0cff72903a566a2b5210c642",
    terms: { pricePerRenderNear: "0.08", allowedUses: ["Fashion", "Beauty", "FoodDrink", "Travel", "Fitness"], maxDays: 30, renderCap: 5 },
  },
  {
    accountId: "likeness-synth-daniel.testnet",
    name: "Daniel",
    face: "/synthetic/daniel.jpg",
    faceSha256: "0f502f31220d5fa08d9278a4e4fdcff0b34b95c7ed02cf99f418763b7e3cf9b4",
    terms: { pricePerRenderNear: "0.06", allowedUses: ["Tech", "Finance", "FoodDrink", "Travel", "Other"], maxDays: 30, renderCap: 5 },
  },
  {
    accountId: "likeness-synth-ana.testnet",
    name: "Ana Reyes",
    face: "/synthetic/ana-reyes.jpg",
    faceSha256: "b3eaef63eeaa01e3174f01aa43d2807d7d3de57967a83653aeacc8f122d8c41a",
    terms: { pricePerRenderNear: "0.05", allowedUses: ["Fashion", "Beauty", "FoodDrink", "Fitness", "Tech"], maxDays: 14, renderCap: 3 },
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
