/** GET /api/me: the signed-in account, its creator record on-chain, and whether it has a stored reference photo. */
import { json, route } from "@/lib/http";
import { captureOf } from "@/lib/db/media";
import { rateLimit } from "@/lib/ratelimit";
import { currentAccount } from "@/lib/session";
import { contractConfigured } from "@/lib/near/config";
import { views } from "@/lib/near/view";
import type { MeResponse } from "@/lib/types";

export const GET = route(async (req: Request) => {
  await rateLimit(req, "read");
  const accountId = await currentAccount();
  if (!accountId) return json<MeResponse>({ accountId: null, creator: null, capture: null });
  const [creator, cap] = await Promise.all([contractConfigured() ? views.getCreator(accountId) : Promise.resolve(null), captureOf(accountId)]);
  return json<MeResponse>({
    accountId,
    creator,
    capture: cap ? { captureSha256: cap.front_sha256, consentAt: new Date(cap.consent_at).getTime() } : null,
  });
});
