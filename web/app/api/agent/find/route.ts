/**
 * POST /api/agent/find: "Find creators". Banned uses are refused first, with the reason; then the deterministic filter
 * and the model's ranking (public profile and terms only). Returns the top 3 and who wasn't eligible; nothing is
 * requested yet. The brand whose function-call key this server holds (AGENT_ACCOUNT_ID) gets its shortlist stored for
 * a licence request; anyone else, signed in or not, gets DEMO MODE (lib/agent/mode.ts): nothing stored, nothing
 * on-chain, rate-limited per IP, its AI spend capped under the "demo" scope and the site's daily cap.
 */
import { HttpError, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { currentAccount, requireSameOrigin } from "@/lib/session";
import { agentAccountId, agentConfigured } from "@/lib/near/agent";
import { findCreators } from "@/lib/agent/brandAgent";
import { findMode } from "@/lib/agent/mode";
import { BRIEF_MAX, FIELD_MAX, isUse, MAX_DAYS_LIMIT, MAX_RENDER_CAP } from "@/lib/rules";
import type { CampaignRequest } from "@/lib/types";

export const maxDuration = 60;

export const POST = route(async (req: Request) => {
  requireSameOrigin(req);
  await rateLimit(req, "ai");
  const account = await currentAccount();
  const mode = findMode(account, agentAccountId(), agentConfigured());
  const b = await readJson<CampaignRequest>(req, 10_000);
  const opt = (v: unknown) => v === undefined || v === "" || (typeof v === "string" && v.trim().length >= 3 && v.length <= FIELD_MAX);
  if (typeof b.brief !== "string" || b.brief.trim().length < 3 || b.brief.length > BRIEF_MAX) throw new HttpError(400, `the brief is required (3 to ${BRIEF_MAX} characters)`);
  if (!opt(b.scene) || !opt(b.product)) throw new HttpError(400, "scene and product are optional; if given, 3 to 200 characters");
  if (!isUse(b.use)) throw new HttpError(400, "unknown use");
  if (b.media !== undefined && b.media !== "image" && b.media !== "video") throw new HttpError(400, "media is image or video");
  if (!Number.isInteger(b.durationDays) || b.durationDays < 1 || b.durationDays > MAX_DAYS_LIMIT) throw new HttpError(400, "licence length is 1 to 180 days");
  if (!Number.isInteger(b.renderCap) || b.renderCap < 1 || b.renderCap > MAX_RENDER_CAP) throw new HttpError(400, "renders must be 1 to 1000");
  const t = (v?: string) => (v ?? "").trim();
  return json(await findCreators(account, { brief: b.brief.trim(), use: b.use, durationDays: b.durationDays, renderCap: b.renderCap, scene: t(b.scene), product: t(b.product), media: b.media === "video" ? "video" : "image" }, mode));
});
