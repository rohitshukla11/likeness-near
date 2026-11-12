/**
 * Shared types: what the pages, the API routes and the contract's views agree on. Amounts are yoctoNEAR as decimal
 * strings (u128 doesn't fit a JS number); times are milliseconds since the epoch unless named `*Ns`.
 */
import type { Use } from "./rules";

export type AccountId = string;
/** yoctoNEAR (10^-24 NEAR) as a decimal string. */
export type Yocto = string;
/** A sha256 as 64 lowercase hex characters (no 0x). */
export type Sha256Hex = string;

/** A creator's terms, as stored on-chain. */
export interface Terms {
  pricePerRender: Yocto;
  allowedUses: Use[];
  /** The longest licence they allow, in days. */
  maxDays: number;
  /** The most renders any one licence may have. */
  renderCap: number;
}

export interface CreatorView {
  accountId: AccountId;
  terms: Terms;
  /** sha256 of the creator's consented front capture frame. */
  captureSha256: Sha256Hex;
  active: boolean;
  registeredAt: number;
  /** Shown to signed-in accounts only; null when there's no capture or no session. */
  faceUrl?: string | null;
}

export interface BrandView {
  accountId: AccountId;
  escrow: Yocto;
  reserved: Yocto;
  maxPerRender: Yocto;
  totalBudget: Yocto;
  spent: Yocto;
}

/** Stored state of a licence on-chain. */
export type LicenceState = "Pending" | "Active" | "Declined" | "Revoked";
/** Computed on every read, never stored: what a licence (and its token) is right now. */
export type LicenceStatus = "Pending" | "Declined" | "Active" | "Exhausted" | "Expired" | "Revoked";

export interface LicenceView {
  id: string;
  /** NEP-171 token id (= the licence id), present once the creator approved the licence. */
  tokenId: string | null;
  creator: AccountId;
  brand: AccountId;
  use: Use;
  price: Yocto;
  renderCap: number;
  rendersUsed: number;
  rendersReserved: number;
  state: LicenceState;
  status: LicenceStatus;
  requestedAt: number;
  issuedAt: number | null;
  expiresAt: number | null;
  termsHash: Sha256Hex;
}

/** The advisory face check's outcome as the contract records it. */
export type FaceCheck = "likely_match" | "needs_creator_review";
export type ReceiptStatus = "Reserved" | "Approved" | "Rejected" | "Released";

export interface ReceiptView {
  sha256: Sha256Hex;
  licenceId: string;
  amount: Yocto;
  faceCheck: FaceCheck;
  status: ReceiptStatus;
  createdAt: number;
  decidedAt: number | null;
}

/** verify(sha256): the public answer for any file. */
export type Verdict = "Licensed" | "Expired" | "Revoked" | "Unknown";
export interface VerifyResult {
  sha256: Sha256Hex;
  verdict: Verdict;
  tokenId: string | null;
  licence: LicenceView | null;
  receipt: ReceiptView | null;
}

/** Every API error body. */
export interface ApiError {
  error: string;
}
