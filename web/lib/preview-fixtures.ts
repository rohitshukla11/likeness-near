/**
 * TEST DATA for the local preview route only (/dev/preview, 404 in production). Never used by real pages. Account
 * names are fictional ("demo-*.testnet") or the synthetic demo creators; images are the synthetic faces standing in for
 * ads. Nothing here exists on-chain.
 */
import { OWNER } from "./profiles";
import { SYNTHETIC } from "./synthetic";
import type { ActivityEvent, BrandOverview, BrandView, CreatorInbox, CreatorView, FindResponse, LicenceView, RenderItem } from "./types";

const NEAR = 10n ** 24n;
const near = (n: number) => ((NEAR * BigInt(Math.round(n * 1000))) / 1000n).toString();
const T = Date.UTC(2026, 10, 13, 9, 30);
const DAY = 86_400_000;

export const PREVIEW_BRAND = "demo-brand.testnet";
const [asha, maya] = SYNTHETIC;

export const creatorOf = (s: Pick<(typeof SYNTHETIC)[number], "accountId" | "terms" | "faceSha256">): CreatorView => ({
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
  use: "FoodDrink",
  price: near(0.04),
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

// ---------------------------------------------------------------- creator side (the owner, the demo's one real creator)

const cL1 = licence("1", OWNER.accountId, "demo-running.testnet", { rendersUsed: 1, rendersReserved: 1 });
const cL2 = licence("2", OWNER.accountId, "demo-travel.testnet", { use: "Travel", state: "Revoked", status: "Revoked", rendersUsed: 1 });
const cL3 = licence("3", OWNER.accountId, "demo-studio.testnet", { use: "Fashion", state: "Pending", status: "Pending" });

export const creatorDemo: { creator: CreatorView; inbox: CreatorInbox } = {
  creator: creatorOf(OWNER),
  inbox: {
    licences: [cL3, cL1, cL2],
    pending: [render(1, cL1, "Reserved", OWNER.face, "needs_creator_review")],
    decided: [render(2, cL1, "Approved", OWNER.face), render(3, cL2, "Approved", OWNER.face)],
    earned: near(0.08),
  },
};

export const creatorEmpty: { creator: CreatorView; inbox: CreatorInbox } = {
  creator: { accountId: "demo-new-creator.testnet", terms: { pricePerRender: near(0.05), allowedUses: ["Fashion", "Tech", "Travel", "Fitness"], maxDays: 30, renderCap: 10 }, captureSha256: null, active: true, registeredAt: T },
  inbox: { licences: [], pending: [], decided: [], earned: "0" },
};

// ---------------------------------------------------------------- brand side (demo-brand, a brand only)

const bL1 = licence("4", asha!.accountId, PREVIEW_BRAND, { rendersUsed: 1, rendersReserved: 1 });
const bL2 = licence("5", maya!.accountId, PREVIEW_BRAND, { use: "Fitness", price: near(0.05), state: "Pending", status: "Pending" });
const bL3 = licence("6", OWNER.accountId, PREVIEW_BRAND, { use: "FoodDrink", price: near(0.04), renderCap: 1, rendersUsed: 1, status: "Exhausted" });

const events: ActivityEvent[] = [
  { at: T - 10 * 60_000, kind: "submit", summary: "submitted the ad for the creator's approval; AI similarity check (advisory): needs the creator's review; the price is reserved, not paid", licenceId: "4", sha256: "1".repeat(64), tx: "9xPreviewTxHashNotOnChain" },
  { at: T - 11 * 60_000, kind: "render", summary: "made ad 2 for licence 4 in 4.2 s; not submitted until the similarity check", licenceId: "4", sha256: "1".repeat(64) },
  { at: T - 40 * 60_000, kind: "request", summary: `asked ${maya!.accountId} for a Fitness licence (14 days, 3 renders); waiting for the creator`, licenceId: "5", tx: "9xPreviewTxHashNotOnChain" },
  { at: T - 41 * 60_000, kind: "shortlist", summary: `chose ${maya!.accountId} (model): the brief is about running shoes; Maya is a fitness coach and allows Fitness` },
  { at: T - 42 * 60_000, kind: "skip", summary: `${asha!.accountId}: the creator doesn't allow Fitness` },
  { at: T - 42 * 60_000, kind: "shortlist", summary: `${maya!.accountId}: Maya Lindqvist (Fitness), a synthetic demo creator (AI-generated face, not a real person); fits: 0.05 NEAR per render, up to 8 renders, 21 days max` },
  { at: T - 60 * 60_000, kind: "blocked", summary: "campaign refused before anything was asked (keywords): banned use in the brief: Political: \"election\"" },
];

export const brandDemo: { brand: BrandView; creators: CreatorView[]; overview: BrandOverview } = {
  brand: { accountId: PREVIEW_BRAND, escrow: near(1.82), reserved: near(0.093), maxPerRender: near(0.1), totalBudget: near(1), spent: near(0.157) },
  creators: [creatorOf(OWNER), creatorOf(asha!), creatorOf(maya!)],
  overview: {
    licences: [bL1, bL2, bL3],
    renders: [render(1, bL1, "Reserved", asha!.face, "needs_creator_review"), render(4, bL1, "Approved", asha!.face), render(5, bL3, "Approved", OWNER.face)],
    activity: events,
  },
};

export const brandEmpty: { brand: BrandView | null; creators: CreatorView[]; overview: BrandOverview } = {
  brand: null,
  creators: [creatorOf(OWNER), creatorOf(asha!), creatorOf(maya!)],
  overview: { licences: [], renders: [], activity: [] },
};

/** The agent's shortlist for a café brief (3 renders), as the brand sees it after "Find creators". */
export const findDemo: FindResponse = {
  status: "ok",
  campaignId: 1,
  budgetLeft: near(0.5),
  top: [
    { creatorId: OWNER.accountId, name: OWNER.name, price: near(0.04), total: near(0.12), fitsBudget: true, reason: "Lifestyle and food creator: a natural fit for a warm café portrait.", by: "model" },
    { creatorId: asha!.accountId, name: asha!.name, price: near(0.04), total: near(0.12), fitsBudget: true, reason: "Cafés and home cooking: fits the brief at the same price.", by: "model" },
    { creatorId: "demo-pricey-creator.testnet", name: "demo-pricey-creator.testnet", price: near(0.2), total: near(0.6), fitsBudget: false, reason: "Allows Food & drink, but the total is over what's left of your budget.", by: "model" },
  ],
  notEligible: [{ creatorId: maya!.accountId, reason: "the creator doesn't allow Food & drink" }],
};
