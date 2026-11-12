/** POST /api/auth/challenge: a one-time NEP-413 message for the wallet to sign (no transaction, no fee). */
import { json, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { createChallenge, requireSameOrigin } from "@/lib/session";

export const POST = route(async (req: Request) => {
  requireSameOrigin(req);
  await rateLimit(req, "action");
  return json(await createChallenge());
});
