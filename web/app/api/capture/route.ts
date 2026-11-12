/**
 * POST /api/capture: the signed-in creator's consented live capture (three JPEG frames compressed in the browser).
 * Stored as uploaded, so the front frame's sha256 here equals the one the page computed and the one register_creator
 * records on-chain.
 */
import { HttpError, json, readJson, route } from "@/lib/http";
import { MAX_FRAME_BYTES, saveCapture } from "@/lib/db/media";
import { rateLimit } from "@/lib/ratelimit";
import { requireAccount, requireSameOrigin } from "@/lib/session";
import type { CaptureRequest, CaptureResponse } from "@/lib/types";

const DATA_URL = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/;

export const POST = route(async (req: Request) => {
  requireSameOrigin(req);
  await rateLimit(req, "action");
  const creator = await requireAccount();
  const b = await readJson<CaptureRequest>(req, 3 * MAX_FRAME_BYTES * 1.4 + 10_000);
  if (b.consent !== true) throw new HttpError(400, "explicit consent is required");
  if (!Array.isArray(b.frames) || b.frames.length !== 3) throw new HttpError(400, "the capture needs three frames: front, slight left, slight right");
  const l = b.liveness;
  if (!l || typeof l.blinks !== "number" || l.blinks < 1 || l.turnedLeft !== true || l.turnedRight !== true) throw new HttpError(400, "the liveness check wasn't completed");
  const frames = b.frames.map((f) => {
    const m = typeof f === "string" ? DATA_URL.exec(f) : null;
    if (!m) throw new HttpError(415, "frames must be JPEG data URLs from the camera");
    return new Uint8Array(Buffer.from(m[1]!, "base64"));
  }) as [Uint8Array, Uint8Array, Uint8Array];
  try {
    return json<CaptureResponse>(await saveCapture(creator, frames, { blinks: l.blinks, turnedLeft: true, turnedRight: true }));
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
});
