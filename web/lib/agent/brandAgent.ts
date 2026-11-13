/**
 * The brand's agent, in two calls the brand drives:
 *   findCreators   brief → banned-use screen (keywords, then the model; fail closed: a refusal stops here with its
 *                  reason) → deterministic filter (lib/agent/shortlist) → the model ranks the eligible creators from
 *                  their public profile and terms only (lib/agent/rank: never an image) → top 3 + "Not eligible".
 *   requestCreator the brand's pick, or "Let the agent choose" (#1) → re-checked against the chain (terms, limits,
 *                  budget: an over-budget creator is never requested) → request_licence, signed by the brand's
 *                  function-call key.
 * Every step goes to the brand's activity log with its reason. "Agents propose. Only the human consents to their face
 * being used": nothing is rendered until the creator approves the licence, and every ad still waits for their approval.
 */
import "server-only";
import { addCampaign, campaignById, linkCampaign, log, videoOptIns } from "../db/records";
import { HttpError } from "../http";
import { agentCall } from "../near/agent";
import { views } from "../near/view";
import { FIELD_MAX, formatNear, textProblems, USE_LABELS } from "../rules";
import type { CampaignRequest, FindResponse, RequestResponse } from "../types";
import { screen } from "../ai/filter";
import { aiEnabled, chatJson } from "../ai/nearai";
import { agentChoice, rankCreators, RANK_SCHEMA, requestable, type RankedCard } from "./rank";
import { filterCreators, limitsSet } from "./shortlist";
import { DEMO_SCOPE, type FindMode } from "./mode";

const self = (creator: string, brand: string) => (creator === brand ? " (self-licence for demo: creator and brand are the same account; the creator still approves in their own wallet)" : "");

/**
 * `mode` "agent": the brand holding the server's key (stored shortlist, then licence requests). "demo": anyone else,
 * signed in or not: the same screen, filter and ranking, but nothing is stored (no campaign, no activity rows) and
 * nothing goes on-chain; AI spend counts under the shared "demo" scope (and the site's daily cap).
 */
export async function findCreators(brand: string | null, req: CampaignRequest, mode: FindMode = "agent"): Promise<FindResponse> {
  const demo = mode === "demo" || !brand;
  const scope = demo ? DEMO_SCOPE : brand!;
  const note = demo ? async () => undefined : (e: Parameters<typeof log>[1]) => log(brand!, e);

  // 1. The brand's own words, screened first (keywords, then the model; fail closed). A refusal stops everything.
  const fields: Record<string, string> = { brief: req.brief };
  if (req.scene) fields.scene = req.scene;
  if (req.product) fields.product = req.product;
  const regex = [...textProblems(req.brief), ...(req.scene ? textProblems(req.scene, "the scene", FIELD_MAX) : []), ...(req.product ? textProblems(req.product, "the product", FIELD_MAX) : [])];
  const first = regex.length ? { allowed: false, reasons: regex, by: "keywords" } : await screen(scope, req.use, fields);
  if (!first.allowed) {
    await note({ kind: "blocked", summary: `campaign refused before anything was asked (${first.by}): ${first.reasons.join("; ")}` });
    return { status: "blocked", reasons: first.reasons };
  }

  // 2. The brand's limits (read-only; none in demo without a signed-in account) and the creators, from the chain; the
  //    deterministic filter. Finding works before the brand has deposited or set limits.
  const b = brand ? await views.getBrand(brand) : null;
  const ready = !demo && limitsSet(b) && BigInt(b.escrow) > BigInt(b.reserved);
  if (!ready) await note({ kind: "shortlist", summary: "no escrow or spending limits yet: showing the shortlist; requesting a licence needs both (Set up once)" });
  const all = await views.listCreators(0, 50);
  const video = req.media === "video" ? { needed: true, allows: await videoOptIns(all.map((c) => c.accountId)) } : undefined;
  const { eligible, ineligible, left } = filterCreators(all, { brief: req.brief, use: req.use, durationDays: req.durationDays, renderCap: req.renderCap }, b, video);
  for (const e of ineligible) await note({ kind: "skip", summary: `${e.creator.accountId}: not eligible: ${e.reason}` });
  const notEligible = ineligible.map((e) => ({ creatorId: e.creator.accountId, reason: e.reason }));
  if (!eligible.length) {
    await note({ kind: "blocked", summary: "no registered creator fits this campaign; nothing was requested" });
    return { status: "no_creator", reasons: ["no creator fits this brief's use, length and renders within your limits"], notEligible };
  }

  // 3. The model ranks the eligible creators (text only); the brand sees the top 3.
  const chat = aiEnabled()
    ? async (messages: { role: "system" | "user"; content: string }[]) => (await chatJson({ brand: scope, what: "chat", schemaName: "creator_ranking", schema: RANK_SCHEMA, messages, maxTokens: 600 })).json
    : undefined;
  const ranked = await rankCreators(req.brief, req.use, eligible, chat);
  const top = ranked.slice(0, 3);
  if (demo) return { status: "ok", campaignId: 0, top, notEligible, budgetLeft: left.toString(), ready: false, demo: true };
  top.forEach((c, i) =>
    void log(brand!, {
      kind: "shortlist",
      summary: `#${i + 1} ${c.creatorId} (${c.by === "model" ? "model" : "rule"}): ${c.reason}; ${formatNear(c.price)} × ${req.renderCap} = ${formatNear(c.total)}${c.fitsBudget ? "" : ", over your budget"}`,
    }),
  );
  const campaignId = await addCampaign(brand!, req, { top, notEligible, left: left.toString() });
  return { status: "ok", campaignId, top, notEligible, budgetLeft: left.toString(), ready };
}

export async function requestCreator(brand: string, campaignId: number, creatorId?: string): Promise<RequestResponse> {
  const c = await campaignById(campaignId);
  if (!c || c.brand !== brand) throw new HttpError(404, "no such campaign for this brand");
  if (c.licence_id) throw new HttpError(409, `this campaign already asked ${c.creator} (licence ${c.licence_id})`);
  const top = (c.shortlist?.top ?? []) as RankedCard[];
  const pick = creatorId ? top.find((t) => t.creatorId === creatorId) : agentChoice(top);
  if (!pick) throw new HttpError(409, creatorId ? "that creator isn't one of the agent's top 3 for this campaign" : "none of the top 3 fits your budget");
  if (!requestable(pick)) throw new HttpError(409, `${pick.name} is over your budget for this campaign (${formatNear(pick.total)})`);

  // Re-check against the chain now: terms, limits and budget may have changed since the shortlist.
  const [b, creator] = await Promise.all([views.getBrand(brand), views.getCreator(pick.creatorId)]);
  if (!limitsSet(b) || BigInt(b.escrow) <= BigInt(b.reserved)) throw new HttpError(409, "deposit escrow and set your spending limits first (Set up once, above)");
  if (!creator) throw new HttpError(409, "the creator is no longer registered");
  const ask = { brief: c.brief, use: c.usage as CampaignRequest["use"], durationDays: c.duration_days, renderCap: c.render_cap };
  const now = filterCreators([creator], ask, b, c.media === "video" ? { needed: true, allows: await videoOptIns([creator.accountId]) } : undefined);
  if (!now.eligible.length) throw new HttpError(409, `no longer eligible: ${now.ineligible[0]?.reason ?? "the creator is paused"}`);
  if (!now.eligible[0]!.fitsBudget) throw new HttpError(409, `over your budget now: ${formatNear(now.eligible[0]!.total)} is more than the ${formatNear(now.left)} left`);

  const by = creatorId ? "picked by the brand" : "the agent's #1";
  try {
    const r = await agentCall("request_licence", { creator_id: pick.creatorId, usage: ask.use, days: ask.durationDays, render_cap: ask.renderCap });
    const licenceId = typeof r.value === "string" ? r.value : String(r.value ?? "");
    await log(brand, { kind: "request", summary: `asked ${pick.creatorId} (${by}) for a ${USE_LABELS[ask.use]} licence (${ask.durationDays} days, ${ask.renderCap} renders); waiting for the creator${self(pick.creatorId, brand)}`, licenceId, tx: r.hash });
    await linkCampaign(campaignId, pick.creatorId, licenceId);
    return { creatorId: pick.creatorId, name: pick.name, licenceId, tx: r.hash, by };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    await log(brand, { kind: "error", summary: `request_licence failed: ${msg}` });
    throw new HttpError(502, `request_licence failed: ${msg}`);
  }
}
