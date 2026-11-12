/** POST /api/auth/logout: ends this session (server-side record and cookie). */
import { json, route } from "@/lib/http";
import { endSession, requireSameOrigin } from "@/lib/session";

export const POST = route(async (req: Request) => {
  requireSameOrigin(req);
  await endSession();
  return json({ ok: true });
});
