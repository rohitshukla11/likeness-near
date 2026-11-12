/**
 * The brand's agent: brief → banned-use screen → shortlist → creator choice (and the scene/product it may refine) →
 * screen again → request_licence on-chain, signed by the brand's function-call key. Every step goes to the brand's
 * activity log with its reason. "Agents propose. Only the human consents to their face being used": nothing is
 * rendered until the creator approves the licence, and every ad still waits for the creator's own approval.
 */
import "server-only";
import { addCampaign, linkCampaign, log } from "../db/records";
import { agentCall } from "../near/agent";
import { views } from "../near/view";
import { FIELD_MAX, textProblems, USE_LABELS, formatNear } from "../rules";
import type { CampaignRequest } from "../types";
import { screen } from "../ai/filter";
import { aiEnabled, chatJson } from "../ai/nearai";
import { clean } from "../ai/prompt";
import { shortlist, type ShortlistEntry } from "./shortlist";

export interface CampaignResult {
  campaignId: number | null;
  status: "requested" | "blocked" | "no_creator";
  reasons: string[];
  creator?: string;
  licenceId?: string;
  tx?: string;
  /** "model" or "rule (AI_MODE=test)": how the creator was chosen. */
  chosenBy?: string;
}

const CHOOSE_SYSTEM = `You are a brand's advertising agent. Choose ONE creator from the candidates for the brief, and write the
scene and the product for a fixed photo template (head-and-shoulders or waist-up, front-facing, the creator's face
unchanged). Scene and product: plain descriptions, each at most 200 characters, no people other than the creator, no
text or logos, nothing political, sexual, involving minors, impersonating anyone, or deceptive. Keep the brand's own
scene and product unless they need tightening. Answer only with JSON matching the schema; reason under 25 words.`;

const CHOOSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["creator_id", "scene", "product", "reason"],
  properties: {
    creator_id: { type: "string" },
    scene: { type: "string", maxLength: FIELD_MAX },
    product: { type: "string", maxLength: FIELD_MAX },
    reason: { type: "string", maxLength: 200 },
  },
};

async function choose(brand: string, req: CampaignRequest, picks: ShortlistEntry[]) {
  const rule = { creator: picks[0]!.creator.accountId, scene: req.scene, product: req.product, reason: "the lowest price among the creators who fit", by: "rule (AI_MODE=test)" };
  if (!aiEnabled() || picks.length === 0) return rule;
  const candidates = picks.slice(0, 10).map((p) => ({
    creator_id: p.creator.accountId,
    price_per_render: formatNear(p.creator.terms.pricePerRender),
    allowed_uses: p.creator.terms.allowedUses,
    render_cap: p.creator.terms.renderCap,
  }));
  const { json } = await chatJson({
    brand,
    what: "chat",
    schemaName: "creator_choice",
    schema: CHOOSE_SCHEMA,
    messages: [
      { role: "system", content: CHOOSE_SYSTEM },
      { role: "user", content: JSON.stringify({ brief: req.brief, use: USE_LABELS[req.use], scene: req.scene, product: req.product, candidates }) },
    ],
  });
  const o = json as { creator_id?: unknown; scene?: unknown; product?: unknown; reason?: unknown };
  const ok = typeof o.creator_id === "string" && candidates.some((c) => c.creator_id === o.creator_id) && typeof o.scene === "string" && typeof o.product === "string";
  if (!ok) return { ...rule, reason: "the model's choice wasn't one of the candidates, so the rule picked", by: "rule (model answer invalid)" };
  return { creator: o.creator_id as string, scene: clean(o.scene as string) || req.scene, product: clean(o.product as string) || req.product, reason: String(o.reason ?? ""), by: "model" };
}

export async function runCampaign(brand: string, req: CampaignRequest): Promise<CampaignResult> {
  // 1. The brand's own words, screened first (keywords, then the model; fail closed).
  const regex = [...textProblems(req.brief), ...textProblems(req.scene, "the scene", FIELD_MAX), ...textProblems(req.product, "the product", FIELD_MAX)];
  const first = regex.length ? { allowed: false, reasons: regex, by: "keywords" } : await screen(brand, req.use, { brief: req.brief, scene: req.scene, product: req.product });
  if (!first.allowed) {
    await log(brand, { kind: "blocked", summary: `campaign refused before anything was asked (${first.by}): ${first.reasons.join("; ")}` });
    return { campaignId: null, status: "blocked", reasons: first.reasons };
  }

  // 2. The brand's limits and the creators, from the chain.
  const b = await views.getBrand(brand);
  if (!b || b.maxPerRender === "0") {
    const r = "deposit escrow and set spending limits first";
    await log(brand, { kind: "blocked", summary: r });
    return { campaignId: null, status: "blocked", reasons: [r] };
  }
  const list = shortlist(await views.listCreators(0, 50), { brief: req.brief, use: req.use, durationDays: req.durationDays, renderCap: req.renderCap }, b);
  for (const e of list) await log(brand, { kind: e.pick ? "shortlist" : "skip", summary: `${e.creator.accountId}: ${e.reason}` });
  const picks = list.filter((e) => e.pick);
  if (!picks.length) {
    await log(brand, { kind: "blocked", summary: "no registered creator fits this campaign; nothing was requested" });
    return { campaignId: null, status: "no_creator", reasons: ["no creator fits"] };
  }

  // 3. The choice, and any refined scene/product screened again.
  const c = await choose(brand, req, picks);
  if (c.scene !== req.scene || c.product !== req.product) {
    const again = await screen(brand, req.use, { scene: c.scene, product: c.product });
    if (!again.allowed) {
      await log(brand, { kind: "blocked", summary: `the agent's refined scene/product was refused (${again.by}): ${again.reasons.join("; ")}` });
      return { campaignId: null, status: "blocked", reasons: again.reasons };
    }
  }
  await log(brand, { kind: "shortlist", summary: `chose ${c.creator} (${c.by}): ${c.reason}` });

  // 4. The licence request, on-chain, signed by the agent's function-call key.
  const campaignId = await addCampaign(brand, { ...req, scene: c.scene, product: c.product });
  try {
    const r = await agentCall("request_licence", { creator_id: c.creator, usage: req.use, days: req.durationDays, render_cap: req.renderCap });
    const licenceId = typeof r.value === "string" ? r.value : String(r.value ?? "");
    const self = c.creator === brand ? " (self-licence for demo: creator and brand are the same account; the creator still approves in their own wallet)" : "";
    await log(brand, { kind: "request", summary: `asked ${c.creator} for a ${USE_LABELS[req.use]} licence (${req.durationDays} days, ${req.renderCap} renders); waiting for the creator${self}`, licenceId, tx: r.hash });
    await linkCampaign(campaignId, c.creator, licenceId);
    return { campaignId, status: "requested", reasons: [], creator: c.creator, licenceId, tx: r.hash, chosenBy: c.by };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 300);
    await log(brand, { kind: "error", summary: `request_licence failed: ${msg}` });
    return { campaignId, status: "blocked", reasons: [msg], creator: c.creator };
  }
}
