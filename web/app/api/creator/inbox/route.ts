/** GET /api/creator/inbox: the signed-in creator's licences (on-chain) and ads (ours, joined with on-chain receipts). */
import { json, route } from "@/lib/http";
import { rendersFor } from "@/lib/db/records";
import { rateLimit } from "@/lib/ratelimit";
import { toRenderItems } from "@/lib/renders";
import { requireAccount } from "@/lib/session";
import { views } from "@/lib/near/view";
import type { CreatorInbox } from "@/lib/types";

export const GET = route(async (req: Request) => {
  await rateLimit(req, "read");
  const creator = await requireAccount();
  const [licences, rows] = await Promise.all([views.licencesForCreator(creator, 0, 50), rendersFor({ creator })]);
  const items = await toRenderItems(rows, licences);
  const earned = items.filter((i) => i.receipt.status === "Approved").reduce((s, i) => s + BigInt(i.receipt.amount), 0n);
  return json<CreatorInbox>({
    licences,
    pending: items.filter((i) => i.receipt.status === "Reserved"),
    decided: items.filter((i) => i.receipt.status !== "Reserved"),
    earned: earned.toString(),
  });
});
