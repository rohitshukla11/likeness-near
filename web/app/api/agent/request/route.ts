/**
 * POST /api/agent/request {campaignId, creatorId?}: request a licence from one of the agent's top 3 for a campaign
 * (no creatorId: "Let the agent choose", its #1 the brand can afford). Re-checked against the chain first; a creator
 * over the brand's budget is refused. The request is signed by the brand's function-call key.
 */
import { HttpError, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { requireAccount, requireSameOrigin } from "@/lib/session";
import { agentAccountId, agentConfigured } from "@/lib/near/agent";
import { requestCreator } from "@/lib/agent/brandAgent";

export const maxDuration = 60;

export const POST = route(async (req: Request) => {
  requireSameOrigin(req);
  await rateLimit(req, "ai");
  const brand = await requireAccount();
  if (!agentConfigured() || brand !== agentAccountId()) throw new HttpError(403, "this server's agent acts only for the brand that holds its key");
  const b = await readJson<{ campaignId?: unknown; creatorId?: unknown }>(req, 2_000);
  if (!Number.isInteger(b.campaignId) || (b.campaignId as number) < 1) throw new HttpError(400, "campaignId is required");
  if (b.creatorId !== undefined && (typeof b.creatorId !== "string" || !/^[a-z0-9._-]{2,64}$/.test(b.creatorId))) throw new HttpError(400, "creatorId must be a NEAR account id");
  return json(await requestCreator(brand, b.campaignId as number, b.creatorId as string | undefined));
});
