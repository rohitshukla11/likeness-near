/**
 * The agent's ranking of the creators who passed the deterministic filter. The model (Qwen, through `chat`) sees only
 * text: the brief, the use, and each candidate's PUBLIC profile and on-chain terms (name, niche, bio, whether synthetic,
 * price, uses, limits). Never an image, a face file, a capture hash or a data URL: `rankPayload` builds the only thing
 * it receives. Its answer is validated in code; anything missing or invalid falls back to the deterministic order
 * (cheapest first). The brand sees the top 3; "Let the agent choose" takes #1 of the ones it can request.
 * Pure apart from the injected `chat`.
 */
import { formatNear, USE_LABELS, type Use } from "../rules.ts";
import { profileOf } from "../profiles.ts";
import type { Candidate } from "./shortlist.ts";

export interface RankedCard {
  creatorId: string;
  name: string;
  /** yoctoNEAR per render, and × renders. */
  price: string;
  total: string;
  fitsBudget: boolean;
  reason: string;
  by: "model" | "rule";
}

export const RANK_SYSTEM = `You are a brand's advertising agent. Rank the candidate creators for the brief, best fit first, using only
the text given: their public profile (name, niche, bio, synthetic or real) and their terms. Every candidate already
meets the brand's ask and limits. Give each a one-line reason (under 20 words) a brand would understand. Answer only
with JSON matching the schema, listing each candidate exactly once.`;

export const RANK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ranking"],
  properties: {
    ranking: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["creator_id", "reason"],
        properties: { creator_id: { type: "string" }, reason: { type: "string", maxLength: 160 } },
      },
    },
  },
};

/** Exactly what the model is given: text fields only. */
export function rankPayload(brief: string, use: Use, eligible: Candidate[]) {
  return {
    brief,
    use: USE_LABELS[use],
    candidates: eligible.map((e) => {
      const p = profileOf(e.creator.accountId);
      return {
        creator_id: e.creator.accountId,
        name: p?.name ?? e.creator.accountId,
        niche: p?.niche ?? "not stated",
        bio: p?.bio ?? "",
        synthetic: p?.synthetic ?? false,
        price_per_render: formatNear(e.creator.terms.pricePerRender),
        allowed_uses: e.creator.terms.allowedUses.map((u) => USE_LABELS[u]),
        max_days: e.creator.terms.maxDays,
        render_cap: e.creator.terms.renderCap,
      };
    }),
  };
}

export type ChatFn = (messages: { role: "system" | "user"; content: string }[]) => Promise<unknown>;

const card = (e: Candidate, reason: string, by: RankedCard["by"]): RankedCard => ({
  creatorId: e.creator.accountId,
  name: profileOf(e.creator.accountId)?.name ?? e.creator.accountId,
  price: e.creator.terms.pricePerRender,
  total: e.total,
  fitsBudget: e.fitsBudget,
  reason,
  by,
});

/** Every eligible creator, ranked: the model's order when its answer is valid, else cheapest first. */
export async function rankCreators(brief: string, use: Use, eligible: Candidate[], chat?: ChatFn): Promise<RankedCard[]> {
  const rule = (why: string) => eligible.map((e, i) => card(e, i === 0 ? `the lowest price among the creators who fit (${why})` : `fits your ask at ${formatNear(e.creator.terms.pricePerRender)} per render (${why})`, "rule"));
  if (!eligible.length) return [];
  if (!chat) return rule("rule: AI is off");
  let answer: unknown;
  try {
    answer = await chat([
      { role: "system", content: RANK_SYSTEM },
      { role: "user", content: JSON.stringify(rankPayload(brief, use, eligible)) },
    ]);
  } catch {
    return rule("rule: the model didn't answer");
  }
  const ranking = (answer as { ranking?: unknown })?.ranking;
  if (!Array.isArray(ranking)) return rule("rule: the model's answer was invalid");
  const byId = new Map(eligible.map((e) => [e.creator.accountId, e]));
  const out: RankedCard[] = [];
  for (const r of ranking as { creator_id?: unknown; reason?: unknown }[]) {
    const e = typeof r?.creator_id === "string" ? byId.get(r.creator_id) : undefined;
    if (!e || out.some((c) => c.creatorId === e.creator.accountId)) continue;
    const reason = typeof r.reason === "string" && r.reason.trim() ? r.reason.trim().slice(0, 160) : "ranked by the agent";
    out.push(card(e, reason, "model"));
  }
  if (!out.length) return rule("rule: the model's answer was invalid");
  // Anyone the model left out keeps the deterministic order, after the model's picks.
  for (const e of eligible) if (!out.some((c) => c.creatorId === e.creator.accountId)) out.push(card(e, "not ranked by the model; cheapest-first order", "rule"));
  return out;
}

/** A card the brand may request: never one over its budget. */
export const requestable = (c: RankedCard) => c.fitsBudget;

/** "Let the agent choose": #1 of the top 3 that can be requested (over-budget cards are skipped). */
export const agentChoice = (top: RankedCard[]): RankedCard | undefined => top.find(requestable);
