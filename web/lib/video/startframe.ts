/**
 * The start-frame loop, pure (every step is injected, so it's unit-tested without any network). As likeness-paypal:
 * at most two start frames. Each is face-matched first (same person, exactly one person): a mismatch only asks for
 * the next frame, and two mismatches end with no video, before anything is stored or screened and before the video
 * model is ever called. A frame that matches is stored privately, then our safety screen decides: passed → use it;
 * other people → the next frame; blocked or no valid answer → no video (fail closed).
 */
export type SafetyOutcome = "passed" | "blocked" | "regenerate" | "dropped";
export interface Frame {
  bytes: Uint8Array;
  mime: string;
}
export interface StartFrameSteps {
  generate: () => Promise<Frame>;
  faceMatch: (f: Frame) => Promise<{ match: boolean }>;
  store: (f: Frame) => Promise<string>;
  safety: (f: Frame, sha256: string, round: number) => Promise<SafetyOutcome>;
}
export type StartFrameResult = ({ ok: true; sha256: string } & Frame & { frames: number }) | { ok: false; reason: string; frames: number };

export const MAX_START_FRAMES = 2;

export async function runStartFrame(s: StartFrameSteps): Promise<StartFrameResult> {
  for (let round = 0; round < MAX_START_FRAMES; round++) {
    const f = await s.generate();
    if (!(await s.faceMatch(f)).match) continue;
    const sha256 = await s.store(f);
    const v = await s.safety(f, sha256, round);
    if (v === "passed") return { ok: true, sha256, ...f, frames: round + 1 };
    if (v === "blocked") return { ok: false, reason: "the safety screen blocked the start frame (a minor or sexualised content)", frames: round + 1 };
    if (v === "dropped") return { ok: false, reason: "the safety screen gave no valid answer, twice (fail closed)", frames: round + 1 };
  }
  return { ok: false, reason: "the start frame didn't pass its checks twice", frames: MAX_START_FRAMES };
}

/**
 * paypal's face match, from the model's JSON answer: a match is exactly one person who is the reference person. As in
 * paypal, a check that can't run (an error, or an answer that isn't JSON) counts as a match: it's only a retry
 * trigger, and the safety screen after it still fails closed.
 */
export async function faceMatchFrom(ask: () => Promise<string>): Promise<{ ran: boolean; match: boolean }> {
  try {
    const v = JSON.parse(await ask()) as { people?: number; sameAsReference?: boolean };
    return { ran: true, match: v.people === 1 && v.sameAsReference === true };
  } catch {
    return { ran: false, match: true };
  }
}
