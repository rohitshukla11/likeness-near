// node --test: the brand agent's shortlist. The deterministic filter's reasons, the ranking's input (text only, never an
// image), over-budget cards never requestable, and "Let the agent choose" taking #1.
import assert from "node:assert/strict";
import { test } from "node:test";
import { filterCreators } from "../lib/agent/shortlist.ts";
import { agentChoice, rankCreators, rankPayload, requestable, type ChatFn, type RankedCard } from "../lib/agent/rank.ts";
import { OWNER } from "../lib/profiles.ts";
import type { BrandView, CreatorView } from "../lib/types.ts";
import type { Use } from "../lib/rules.ts";

const NEAR = 10n ** 24n;
const near = (n: number) => ((NEAR * BigInt(Math.round(n * 1000))) / 1000n).toString();
const creator = (accountId: string, o: { price?: number; uses?: Use[]; maxDays?: number; renderCap?: number; active?: boolean } = {}): CreatorView => ({
  accountId,
  terms: { pricePerRender: near(o.price ?? 0.04), allowedUses: o.uses ?? ["FoodDrink", "Travel"], maxDays: o.maxDays ?? 30, renderCap: o.renderCap ?? 10 },
  captureSha256: "ab".repeat(32),
  active: o.active ?? true,
  registeredAt: 0,
});
// 0.1 per render at most; 0.5 left of the budget (1 total − 0.3 spent − 0.2 reserved), 1.8 free in escrow.
const brand: BrandView = { accountId: "brand.testnet", escrow: near(2), reserved: near(0.2), maxPerRender: near(0.1), totalBudget: near(1), spent: near(0.3) };
const ask = { brief: "Morning coffee campaign for a neighbourhood café", use: "FoodDrink" as Use, durationDays: 30, renderCap: 3 };

test("the filter gives one plain reason per creator who isn't eligible, and leaves paused creators out", () => {
  const { eligible, ineligible, left } = filterCreators(
    [
      creator("ok.testnet"),
      creator("nouse.testnet", { uses: ["Tech"] }),
      creator("short.testnet", { maxDays: 14 }),
      creator("fewrenders.testnet", { renderCap: 2 }),
      creator("pricey.testnet", { price: 0.2 }),
      creator("paused.testnet", { active: false }),
      creator("overbudget.testnet", { price: 0.09 }),
    ],
    ask,
    brand,
  );
  assert.equal(left, BigInt(near(0.5)));
  const why = Object.fromEntries(ineligible.map((i) => [i.creator.accountId, i.reason]));
  assert.equal(why["nouse.testnet"], "the creator doesn't allow Food & drink");
  assert.equal(why["short.testnet"], "30 days is longer than the creator allows (14 days)");
  assert.equal(why["fewrenders.testnet"], "3 renders is more than the creator allows (2)");
  assert.match(why["pricey.testnet"]!, /above your limit/);
  assert.equal(why["paused.testnet"], undefined, "paused creators are left out entirely");
  assert.deepEqual(
    eligible.map((e) => [e.creator.accountId, e.total, e.fitsBudget]),
    [
      ["ok.testnet", near(0.12), true],
      ["overbudget.testnet", near(0.27), true],
    ],
  );
  // 0.09 × 6 renders = 0.54 > 0.5 left: eligible, but over budget.
  const six = filterCreators([creator("overbudget.testnet", { price: 0.09 })], { ...ask, renderCap: 6 }, brand);
  assert.equal(six.eligible[0]!.fitsBudget, false);
});

test("finding works before the brand has set anything up: every fit is shown, none can be requested", () => {
  const none = filterCreators([creator("ok.testnet"), creator("pricey.testnet", { price: 0.5 }), creator("nouse.testnet", { uses: ["Tech"] })], ask, null);
  assert.equal(none.left, 0n);
  assert.deepEqual(
    none.eligible.map((e) => [e.creator.accountId, e.fitsBudget]),
    [
      ["ok.testnet", false],
      ["pricey.testnet", false],
    ],
  );
  assert.deepEqual(
    none.ineligible.map((i) => i.creator.accountId),
    ["nouse.testnet"],
  );
  const noLimits = filterCreators([creator("ok.testnet")], ask, { ...brand, maxPerRender: "0", totalBudget: "0" });
  assert.equal(noLimits.eligible[0]!.fitsBudget, false);
});

test("the ranking model receives text only: public profile and terms, never an image, face file or hash", async () => {
  const { eligible } = filterCreators([creator(OWNER.accountId), creator("likeness-synth-asha.testnet"), creator("someone.testnet")], ask, brand);
  let seen: Parameters<ChatFn>[0] = [];
  const chat: ChatFn = async (messages) => {
    seen = messages;
    return { ranking: [{ creator_id: "likeness-synth-asha.testnet", reason: "cafés" }, { creator_id: OWNER.accountId, reason: "food" }] };
  };
  const ranked = await rankCreators(ask.brief, ask.use, eligible, chat);
  assert.equal(seen.length, 2);
  for (const m of seen) {
    assert.equal(typeof m.content, "string", "plain text messages only (no image_url parts)");
    assert.doesNotMatch(m.content, /image_url|data:|\.jpe?g|\.png|\/synthetic\/|\/creators\/|[0-9a-f]{64}/i);
  }
  const payload = rankPayload(ask.brief, ask.use, eligible);
  assert.deepEqual(Object.keys(payload.candidates[0]!).sort(), ["allowed_uses", "bio", "creator_id", "max_days", "name", "niche", "price_per_render", "render_cap", "synthetic"]);
  // The model's order, then anyone it left out in the deterministic order.
  assert.deepEqual(
    ranked.map((r) => [r.creatorId, r.by]),
    [
      ["likeness-synth-asha.testnet", "model"],
      [OWNER.accountId, "model"],
      ["someone.testnet", "rule"],
    ],
  );
  // An invalid answer falls back to cheapest first.
  const bad = await rankCreators(ask.brief, ask.use, eligible, async () => ({ ranking: [{ creator_id: "not-a-candidate.testnet", reason: "x" }] }));
  assert.ok(bad.every((r) => r.by === "rule"));
});

const card = (id: string, fitsBudget: boolean): RankedCard => ({ creatorId: id, name: id, price: near(0.1), total: near(0.3), fitsBudget, reason: "", by: "model" });

test("over-budget cards can't be requested, and the agent never chooses one", () => {
  assert.equal(requestable(card("a", false)), false);
  assert.equal(requestable(card("b", true)), true);
  assert.equal(agentChoice([card("a", false), card("b", true), card("c", true)])?.creatorId, "b");
  assert.equal(agentChoice([card("a", false)]), undefined);
});

test('"Let the agent choose" picks #1', () => {
  assert.equal(agentChoice([card("first", true), card("second", true), card("third", true)])?.creatorId, "first");
});
