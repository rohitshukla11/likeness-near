/**
 * POST /api/agent/render {licenceId, retryOf?}: the agent makes the next ad under an Active licence (one billed image
 * edit, under the cost cap) and stores it privately. Returns its sha256 only (never the image in JSON).
 */
import { HEX64, HttpError, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { requireAccount, requireSameOrigin } from "@/lib/session";
import { agentAccountId, agentConfigured } from "@/lib/near/agent";
import { makeAd } from "@/lib/agent/pipeline";
import { AiError } from "@/lib/ai/nearai";

export const maxDuration = 120;

export const POST = route(async (req: Request) => {
  requireSameOrigin(req);
  await rateLimit(req, "ai");
  const brand = await requireAccount();
  if (!agentConfigured() || brand !== agentAccountId()) throw new HttpError(403, "this server's agent acts only for the brand that holds its key");
  const b = await readJson<{ licenceId?: unknown; retryOf?: unknown }>(req, 2_000);
  if (typeof b.licenceId !== "string" || !/^\d{1,19}$/.test(b.licenceId)) throw new HttpError(400, "licenceId is required");
  if (b.retryOf !== undefined && (typeof b.retryOf !== "string" || !HEX64.test(b.retryOf))) throw new HttpError(400, "retryOf must be a sha256");
  try {
    return json(await makeAd(brand, b.licenceId, b.retryOf as string | undefined));
  } catch (e) {
    if (e instanceof AiError) throw new HttpError(502, e.message);
    throw e;
  }
});
