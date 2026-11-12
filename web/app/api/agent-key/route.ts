/** GET /api/agent-key: the PUBLIC half of the agent's function-call key, for the brand it acts for only. */
import { HttpError, json, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { requireAccount } from "@/lib/session";
import { agentAccountId, agentConfigured, agentKeyInfo } from "@/lib/near/agent";
import type { AgentKeyInfo } from "@/lib/types";

export const GET = route(async (req: Request) => {
  await rateLimit(req, "read");
  const who = await requireAccount();
  if (!agentConfigured() || who !== agentAccountId()) throw new HttpError(404, "this server has no agent key for your account");
  return json<AgentKeyInfo>(agentKeyInfo());
});
