/**
 * TEST DATA for the local preview route only (/dev/preview, 404 in production). Never used by real pages. Account
 * names are fictional ("demo-*.testnet") or the synthetic demo creators; images are the synthetic faces standing in for
 * ads. Nothing here exists on-chain.
 */
import { SYNTHETIC } from "./synthetic";
import type { ActivityEvent, BrandOverview, BrandView, CreatorInbox, CreatorView, LicenceView, RenderItem } from "./types";

const NEAR = 10n ** 24n;
const near = (n: number) => ((NEAR * BigInt(Math.round(n * 1000))) / 1000n).toString();
const T = Date.UTC(2026, 10, 13, 9, 30);
const DAY = 86_400_000;

export const PREVIEW_BRAND = "demo-brand.testnet";
const [asha, daniel, ana] = SYNTHETIC;

export const creatorOf = (s: (typeof SYNTHETIC)[number]): CreatorView => ({
  accountId: s.accountId,
  terms: { pricePerRender: near(Number(s.terms.pricePerRenderNear)), allowedUses: s.terms.allowedUses, maxDays: s.terms.maxDays, renderCap: s.terms.renderCap },
  captureSha256: s.faceSha256,
  active: true,
  registeredAt: T - 3 * DAY,
});

const licence = (id: string, creator: string, brand: string, o: Partial<LicenceView> = {}): LicenceView => ({
  id,
  tokenId: o.state === "Pending" ? null : id,
  creator,
  brand,
  use: "Fitness",
  price: near(0.08),
  renderCap: 3,
  rendersUsed: 0,
  rendersReserved: 0,
  state: "Active",
  status: "Active",
  requestedAt: T - 2 * DAY,
  issuedAt: o.state === "Pending" ? null : T - 2 * DAY + 3_600_000,
  expiresAt: o.state === "Pending" ? null : T + 28 * DAY,
  termsHash: "7f".repeat(32),
  ...o,
});

const render = (n: number, l: LicenceView, status: RenderItem["receipt"]["status"], face: string, verdict: "likely_match" | "needs_creator_review" = "likely_match"): RenderItem => ({
  receipt: { sha256: String(n).repeat(64).slice(0, 64), licenceId: l.id, amount: l.price, faceCheck: verdict, status, createdAt: T - n * 3_600_000, decidedAt: status === "Reserved" ? null : T - n * 3_000_000 },
  licence: l,
  mediaUrl: face,
  faceCheck: { verdict, reason: verdict === "likely_match" ? "Same face shape, eyes, nose and hairline; only the scene differs." : "The face is small and partly turned.", samePerson: verdict === "likely_match" ? "yes" : "unclear", confidence: verdict === "likely_match" ? 0.93 : 0.6 },
  prompt: "Head-and-shoulders or waist-up advertisement photo, front-facing, face large in frame. … Scene: a sunny running track at dawn. Product: plain white running shoes. No other people. No text or logos.",
  decisionTx: status === "Approved" ? "9xPreviewTxHashNotOnChain" : null,
});

// ---------------------------------------------------------------- creator side (Asha, a synthetic demo creator)

const cL1 = licence("1", asha!.accountId, "demo-running.testnet", { rendersUsed: 1, rendersReserved: 1 });
const cL2 = licence("2", asha!.accountId, "demo-cafe.testnet", { use: "FoodDrink", state: "Revoked", status: "Revoked", rendersUsed: 1 });
const cL3 = licence("3", asha!.accountId, "demo-studio.testnet", { use: "Fashion", state: "Pending", status: "Pending" });

export const creatorDemo: { creator: CreatorView; inbox: CreatorInbox } = {
  creator: creatorOf(asha!),
  inbox: {
    licences: [cL3, cL1, cL2],
    pending: [render(1, cL1, "Reserved", asha!.face, "needs_creator_review")],
    decided: [render(2, cL1, "Approved", asha!.face), render(3, cL2, "Approved", asha!.face)],
    earned: near(0.16),
  },
};

export const creatorEmpty: { creator: CreatorView; inbox: CreatorInbox } = {
  creator: { accountId: "demo-new-creator.testnet", terms: { pricePerRender: near(0.05), allowedUses: ["Fashion", "Tech", "Travel", "Fitness"], maxDays: 30, renderCap: 10 }, captureSha256: null, active: true, registeredAt: T },
  inbox: { licences: [], pending: [], decided: [], earned: "0" },
};

// ---------------------------------------------------------------- brand side (demo-brand, which is also a creator)

const bL1 = licence("4", asha!.accountId, PREVIEW_BRAND, { rendersUsed: 1, rendersReserved: 1 });
const bL2 = licence("5", daniel!.accountId, PREVIEW_BRAND, { use: "Tech", price: near(0.06), state: "Pending", status: "Pending" });
const bL3 = licence("6", PREVIEW_BRAND, PREVIEW_BRAND, { use: "Fitness", price: near(0.05), renderCap: 1, rendersUsed: 1, status: "Exhausted" });

const events: ActivityEvent[] = [
  { at: T - 10 * 60_000, kind: "submit", summary: "submitted the ad for the creator's approval; AI similarity check (advisory): needs the creator's review; the price is reserved, not paid", licenceId: "4", sha256: "1".repeat(64), tx: "9xPreviewTxHashNotOnChain" },
  { at: T - 11 * 60_000, kind: "render", summary: "made ad 2 for licence 4 in 4.2 s; not submitted until the similarity check", licenceId: "4", sha256: "1".repeat(64) },
  { at: T - 40 * 60_000, kind: "request", summary: `asked ${daniel!.accountId} for a Tech licence (30 days, 3 renders); waiting for the creator`, licenceId: "5", tx: "9xPreviewTxHashNotOnChain" },
  { at: T - 41 * 60_000, kind: "shortlist", summary: `chose ${daniel!.accountId} (model): the brief is about a laptop; Daniel allows Tech` },
  { at: T - 42 * 60_000, kind: "skip", summary: `${ana!.accountId}: the creator doesn't allow Finance & crypto` },
  { at: T - 42 * 60_000, kind: "shortlist", summary: `${daniel!.accountId}: Daniel, a synthetic demo creator (AI-generated face, not a real person); fits: 0.06 NEAR per render, up to 5 renders, 30 days max` },
  { at: T - 60 * 60_000, kind: "blocked", summary: "campaign refused before anything was asked (keywords): banned use in the brief: Political: \"election\"" },
];

export const brandDemo: { brand: BrandView; creators: CreatorView[]; overview: BrandOverview } = {
  brand: { accountId: PREVIEW_BRAND, escrow: near(1.82), reserved: near(0.093), maxPerRender: near(0.1), totalBudget: near(1), spent: near(0.157) },
  creators: [creatorOf(asha!), creatorOf(daniel!), creatorOf(ana!), { ...creatorEmpty.creator, accountId: PREVIEW_BRAND, terms: { ...creatorEmpty.creator.terms, pricePerRender: near(0.05) } }],
  overview: {
    licences: [bL1, bL2, bL3],
    renders: [render(1, bL1, "Reserved", asha!.face, "needs_creator_review"), render(4, bL1, "Approved", asha!.face), render(5, bL3, "Approved", ana!.face)],
    activity: events,
  },
};

export const brandEmpty: { brand: BrandView | null; creators: CreatorView[]; overview: BrandOverview } = {
  brand: null,
  creators: [creatorOf(asha!), creatorOf(daniel!), creatorOf(ana!)],
  overview: { licences: [], renders: [], activity: [] },
};
