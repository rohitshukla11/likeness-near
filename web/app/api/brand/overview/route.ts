/** GET /api/brand/overview: the signed-in brand's licences (on-chain), ads and agent activity. */
import { json, route } from "@/lib/http";
import { activity, rendersFor } from "@/lib/db/records";
import { rateLimit } from "@/lib/ratelimit";
import { toRenderItems } from "@/lib/renders";
import { requireAccount } from "@/lib/session";
import { views } from "@/lib/near/view";
import type { BrandOverview } from "@/lib/types";

export const GET = route(async (req: Request) => {
  await rateLimit(req, "read");
  const brand = await requireAccount();
  const [licences, rows, events] = await Promise.all([views.licencesForBrand(brand, 0, 50), rendersFor({ brand }), activity(brand)]);
  return json<BrandOverview>({ licences, renders: await toRenderItems(rows, licences), activity: events });
});
