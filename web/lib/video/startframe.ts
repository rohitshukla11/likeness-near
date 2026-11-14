/**
 * The start-frame loop, pure (every step is injected, so it's unit-tested without any network). At most two start
 * frames. Each is face-matched first (same person, exactly one person), and the face check fails closed: a mismatch,
 * or a check that can't run or gives no valid answer, only asks for the next frame, and two failures end with no
 * video, before anything is stored or screened and before the video model is ever called. A frame that matches is
 * stored privately, then our safety screen decides: passed → use it; other people → the next frame; blocked or no
 * valid answer → no video (fail closed).
 */
export type SafetyOutcome = "passed" | "blocked" | "regenerate" | "dropped";
export interface Frame {
  bytes: Uint8Array;
  mime: string;
}
export interface StartFrameSteps {
  generate: () => Promise<Frame>;
  faceMatch: (f: Frame) => Promise<{ ran?: boolean; match: boolean }>;
  store: (f: Frame) => Promise<string>;
  safety: (f: Frame, sha256: string, round: number) => Promise<SafetyOutcome>;
}
export type StartFrameResult = ({ ok: true; sha256: string } & Frame & { frames: number }) | { ok: false; reason: string; frames: number };

export const MAX_START_FRAMES = 2;

export async function runStartFrame(s: StartFrameSteps): Promise<StartFrameResult> {
  let last = "the start frame didn't pass its checks twice";
  for (let round = 0; round < MAX_START_FRAMES; round++) {
    const f = await s.generate();
    const fm = await s.faceMatch(f);
    if (!fm.match) {
      last = fm.ran === false
        ? "the start frame's face check couldn't run or gave no valid answer, twice (fail closed)"
        : "the start frame's face check failed twice (fail closed)";
      continue;
    }
    const sha256 = await s.store(f);
    const v = await s.safety(f, sha256, round);
    if (v === "passed") return { ok: true, sha256, ...f, frames: round + 1 };
    if (v === "blocked") return { ok: false, reason: "the safety screen blocked the start frame (a minor or sexualised content)", frames: round + 1 };
    if (v === "dropped") return { ok: false, reason: "the safety screen gave no valid answer, twice (fail closed)", frames: round + 1 };
    last = "the start frame showed other people twice";
  }
  return { ok: false, reason: last, frames: MAX_START_FRAMES };
}

/**
 * The face match, from the model's JSON answer: a match is exactly one person who is the reference person. Fail
 * closed: a check that can't run (an error, an answer that isn't JSON, or JSON without a valid people count and
 * same-person answer) is NOT a match (ran: false), so it asks for the next frame like a mismatch does.
 */
export async function faceMatchFrom(ask: () => Promise<string>): Promise<{ ran: boolean; match: boolean }> {
  try {
    const v = JSON.parse(await ask()) as { people?: unknown; sameAsReference?: unknown } | null;
    if (!v || typeof v !== "object" || typeof v.people !== "number" || typeof v.sameAsReference !== "boolean") return { ran: false, match: false };
    return { ran: true, match: v.people === 1 && v.sameAsReference === true };
  } catch {
    return { ran: false, match: false };
  }
}
