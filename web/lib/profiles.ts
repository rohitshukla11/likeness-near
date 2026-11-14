/**
 * Who can be a creator here. There is no creator sign-up: the demo has exactly one real creator, the project's author
 * (OWNER, his own photo, published with his consent), plus the synthetic demo creators (lib/synthetic.ts). Every other
 * account that signs in is a brand only. The owner's photo is also his reference capture (scripts/owner-creator.ts
 * stores it; its sha256 is the capture_sha256 he registers with).
 */
import type { Use } from "./rules";
import { creatorLabel, syntheticOf } from "./synthetic.ts";

export const OWNER = {
  accountId: "rohitshukla.testnet",
  name: "Rohit Shukla",
  niche: "Lifestyle & food",
  bio: "The project's author, licensing his own face for this demo.",
  face: "/creators/rohit.jpg",
  /** A wider crop of the same photo (jacket and mic in frame), for the creator cards only; never the reference. */
  card: "/creators/rohit-card.jpg",
  /**
   * The video start frame's reference (as in likeness-paypal): the 800x800 ORIGINAL stage photo, stored privately in the
   * database by scripts/video-reference.ts. The registered on-chain reference (faceSha256, 89a4…) is a crop of it.
   */
  videoReferenceSha256: "0f03b10c88939f283ea2f9d61fba956abd5d136757e78616290567be51b9f76a",
  faceSha256: "89a4d9973341de96b3342ec2c678ea8e7975b219af30a2b676cfe18883c172af",
  terms: { pricePerRenderNear: "0.04", allowedUses: ["FoodDrink", "Travel", "Fashion", "Beauty", "Fitness"] as Use[], maxDays: 30, renderCap: 10 },
};

/** The one account that has a creator side (and the Creator | Brand switch). */
export const isOwner = (accountId: string | null | undefined) => accountId === OWNER.accountId;

export interface PublicProfile {
  name: string;
  niche: string;
  bio: string;
  /** A public face: the owner's photo or a synthetic AI-generated face. */
  face: string;
  /** The image on the creator cards (a wider crop for the owner; the face for everyone else). */
  card: string;
  synthetic: boolean;
}

/** The public profile of the owner or a synthetic demo creator; undefined for anyone else (who shows an initial). */
export function profileOf(accountId: string | null | undefined): PublicProfile | undefined {
  if (isOwner(accountId)) return { name: OWNER.name, niche: OWNER.niche, bio: OWNER.bio, face: OWNER.face, card: OWNER.card, synthetic: false };
  const s = syntheticOf(accountId);
  return s && { name: s.name, niche: s.niche, bio: s.bio, face: s.face, card: s.face, synthetic: true };
}

/** "Rohit Shukla", "Asha (synthetic demo creator)", or the account id. */
export const displayName = (accountId: string) => (isOwner(accountId) ? OWNER.name : creatorLabel(accountId));
