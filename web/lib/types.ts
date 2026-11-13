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
  /** sha256 of the creator's reference photo (what every ad is edited from); null if none is recorded. */
  captureSha256: Sha256Hex | null;
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

// ---------------------------------------------------------------- API responses the pages use

/** GET /api/me: who our session says is signed in (a NEAR account proven with a signed message). */
export interface MeResponse {
  accountId: AccountId | null;
  /** The creator's on-chain record, if registered. */
  creator: CreatorView | null;
  /** Their stored reference photo, if any. */
  capture: { captureSha256: Sha256Hex; consentAt: number } | null;
}

/** The advisory similarity check as the app shows it (the receipt keeps only likely_match / needs_creator_review). */
export interface FaceCheckDetail {
  verdict: FaceCheck;
  /** The model's one-line reason, if it answered. */
  reason: string | null;
  samePerson?: "yes" | "no" | "unclear";
  confidence?: number;
}

/** One ad as the creator and brand see it. */
export interface RenderItem {
  receipt: ReceiptView;
  licence: LicenceView;
  /** Same-origin URL of the exact bytes (GET /api/media/<sha256>). */
  mediaUrl: string;
  faceCheck: FaceCheckDetail;
  /** The exact prompt sent to the image model. */
  prompt: string;
  /** Approve/reject transaction, once decided. */
  decisionTx: string | null;
}

/** GET /api/creator/inbox: the signed-in creator's licence requests, licences and ads. */
export interface CreatorInbox {
  licences: LicenceView[];
  /** Ads waiting for the creator's decision (receipt Reserved). */
  pending: RenderItem[];
  /** Ads already decided (Approved / Rejected / Released), newest first. */
  decided: RenderItem[];
  /** Sum of approved amounts paid to this creator. */
  earned: Yocto;
}

// ---------------------------------------------------------------- brand side

/** GET /api/agent-key: the agent's function-call key the server holds for this brand (public half only). */
export interface AgentKeyInfo {
  brand: AccountId;
  publicKey: string;
  contractId: AccountId;
  methods: string[];
  allowance: Yocto;
}

/** POST /api/agent/find: what the brand asks its agent for. Scene and product are optional (the agent writes them after
 * the creator approves); whatever is given is screened for banned uses first. */
export interface CampaignRequest {
  brief: string;
  use: Use;
  durationDays: number;
  renderCap: number;
  scene?: string;
  product?: string;
}

/** One of the agent's top 3: public profile and terms only. */
export interface ShortlistCard {
  creatorId: string;
  name: string;
  price: Yocto;
  /** price × renders. */
  total: Yocto;
  fitsBudget: boolean;
  reason: string;
  by: "model" | "rule";
}

export type FindResponse =
  | { status: "blocked"; reasons: string[] }
  | { status: "no_creator"; reasons: string[]; notEligible: { creatorId: string; reason: string }[] }
  | { status: "ok"; campaignId: number; top: ShortlistCard[]; notEligible: { creatorId: string; reason: string }[]; budgetLeft: Yocto };

/** POST /api/agent/request {campaignId, creatorId?}: no creatorId = "Let the agent choose" (#1). */
export interface RequestResponse {
  creatorId: string;
  name: string;
  licenceId: string;
  tx: string;
  by: string;
}

/** One line of the agent's activity log. */
export interface ActivityEvent {
  at: number;
  kind: "shortlist" | "skip" | "request" | "plan" | "render" | "check" | "submit" | "blocked" | "error";
  summary: string;
  licenceId?: string | null;
  sha256?: Sha256Hex | null;
  tx?: string | null;
}

/** GET /api/brand/overview: the signed-in brand's licences, ads and agent activity. */
export interface BrandOverview {
  licences: LicenceView[];
  renders: RenderItem[];
  activity: ActivityEvent[];
}
