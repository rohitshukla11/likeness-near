/**
 * Whether a video may be started, as one plain reason or null. Pure: the job runner gathers the facts (the flag, the
 * creator's opt-in, the start image's approval, the licence's room, the estimate, today's count) and refuses on the
 * first reason. Nothing is called or billed when this refuses.
 */
export interface VideoAsk {
  enabled: boolean;
  creatorAllows: boolean;
  /** The start frame is an ad image the creator approved on-chain. */
  startApproved: boolean;
  /** Renders left on the licence (cap − used − reserved). */
  licenceRoom: number;
  estUsd: number;
  capUsd: number;
  usedToday: number;
  maxPerDay: number;
}

export function videoRefusal(a: VideoAsk): string | null {
  if (!a.enabled) return "video is off on this server";
  if (!a.creatorAllows) return "the creator hasn't allowed video";
  if (!a.startApproved) return "a video starts only from an ad image the creator has approved";
  if (a.licenceRoom < 1) return "this licence has no render left for a video";
  if (a.estUsd > a.capUsd) return `the estimated $${a.estUsd.toFixed(2)} is over the per-video cap ($${a.capUsd.toFixed(2)})`;
  if (a.usedToday >= a.maxPerDay) return `today's video cap is reached (${a.maxPerDay} per day)`;
  return null;
}
