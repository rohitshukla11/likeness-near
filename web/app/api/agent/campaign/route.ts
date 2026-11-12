/**
 * POST /api/agent/campaign: the signed-in brand asks its agent for a campaign. Only the brand whose function-call key
 * this server holds (AGENT_ACCOUNT_ID) can run it. Banned uses are refused before any model call or transaction.
 */
import { HttpError, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { requireAccount, requireSameOrigin } from "@/lib/session";
import { agentAccountId, agentConfigured } from "@/lib/near/agent";
import { runCampaign } from "@/lib/agent/brandAgent";
import { BRIEF_MAX, FIELD_MAX, isUse, MAX_DAYS_LIMIT, MAX_RENDER_CAP } from "@/lib/rules";
import type { CampaignRequest } from "@/lib/types";

export const maxDuration = 60;

export const POST = route(async (req: Request) => {
  requireSameOrigin(req);
  await rateLimit(req, "ai");
  const brand = await requireAccount();
  if (!agentConfigured() || brand !== agentAccountId()) throw new HttpError(403, "this server's agent acts only for the brand that holds its key");
  const b = await readJson<CampaignRequest>(req, 10_000);
  const str = (v: unknown, max: number) => typeof v === "string" && v.trim().length >= 3 && v.length <= max;
  if (!str(b.brief, BRIEF_MAX) || !str(b.scene, FIELD_MAX) || !str(b.product, FIELD_MAX)) throw new HttpError(400, "brief, scene and product are required (scene and product at most 200 characters)");
  if (!isUse(b.use)) throw new HttpError(400, "unknown use");
  if (!Number.isInteger(b.durationDays) || b.durationDays < 1 || b.durationDays > MAX_DAYS_LIMIT) throw new HttpError(400, "licence length is 1 to 180 days");
  if (!Number.isInteger(b.renderCap) || b.renderCap < 1 || b.renderCap > MAX_RENDER_CAP) throw new HttpError(400, "renders must be 1 to 1000");
  return json(await runCampaign(brand, { brief: b.brief, use: b.use, durationDays: b.durationDays, renderCap: b.renderCap, scene: b.scene, product: b.product }));
});
