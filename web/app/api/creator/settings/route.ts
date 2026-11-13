/**
 * The signed-in creator's own settings. GET → { allowVideo, videoEnabled }. POST { allowVideo } → saved.
 * Video is made outside NEAR AI's TEE, so it's off until the creator turns it on; only they can change it.
 */
import { HttpError, json, readJson, route } from "@/lib/http";
import { requireAccount, requireSameOrigin } from "@/lib/session";
import { allowsVideo, setAllowVideo } from "@/lib/db/records";
import { contractConfigured } from "@/lib/near/config";
import { views } from "@/lib/near/view";
import { videoEnabled } from "@/lib/video/config";

export const GET = route(async () => {
  const account = await requireAccount();
  return json({ allowVideo: await allowsVideo(account), videoEnabled: videoEnabled() });
});

export const POST = route(async (req: Request) => {
  requireSameOrigin(req);
  const account = await requireAccount();
  if (!contractConfigured() || !(await views.getCreator(account))) throw new HttpError(403, "only a registered creator has these settings");
  const b = await readJson<{ allowVideo?: unknown }>(req, 500);
  if (typeof b.allowVideo !== "boolean") throw new HttpError(400, "allowVideo must be true or false");
  await setAllowVideo(account, b.allowVideo);
  return json({ allowVideo: b.allowVideo, videoEnabled: videoEnabled() });
});
