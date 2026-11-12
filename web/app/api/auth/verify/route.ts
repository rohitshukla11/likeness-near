/** POST /api/auth/verify: checks the signed challenge (full-access key, valid signature, unused nonce) and starts a session. */
import { json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { requireSameOrigin, verifyAndStart, type SignedIn } from "@/lib/session";

export const POST = route(async (req: Request) => {
  requireSameOrigin(req);
  await rateLimit(req, "action");
  const accountId = await verifyAndStart(await readJson<SignedIn>(req, 10_000));
  return json({ accountId });
});
