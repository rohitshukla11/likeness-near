// node --test: video ads (lib/video). Job states, caps that refuse, opted-out creators excluded, the sha256 over the
// stored bytes, approval before payment (the agent only ever submits), and Verify's browser hash matching a video.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { nextStep, videoOf } from "../lib/video/jobstate.ts";
import { videoRefusal, type VideoAsk } from "../lib/video/caps.ts";
import { estimateUsd, videoEnabled, videoMaxPerDay, videoUsdCap } from "../lib/video/config.ts";
import { blobStorage, localVideoStorage, videoStorage } from "../lib/video/storage.ts";
import { filterCreators } from "../lib/agent/shortlist.ts";
import { AGENT_METHODS } from "../lib/near/methods.ts";
import { sha256OfBytes } from "../lib/capture.ts";
import type { BrandView, CreatorView } from "../lib/types.ts";
import type { Use } from "../lib/rules.ts";

// A tiny MP4-shaped file: a 24-byte "ftyp" box, then some payload.
const mp4 = (n = 64) => {
  const b = new Uint8Array(24 + n);
  b.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], 0);
  for (let i = 24; i < b.length; i++) b[i] = (i * 31) & 0xff;
  return b;
};
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

test("job states: wait while running, done with a clip, fail on refusal, empty answer or deadline", () => {
  assert.deepEqual(nextStep({ status: "in_progress" }, 10_000), { kind: "wait" });
  assert.deepEqual(nextStep({}, 10_000), { kind: "wait" }, "a missed check is a wait");
  assert.deepEqual(nextStep({ status: "completed", output_video: { data: "AAAA" } }, 60_000), { kind: "done" });
  assert.deepEqual(nextStep({ status: "completed", output_video: { uri: "https://files/x" } }, 60_000), { kind: "done" });
  assert.equal(nextStep({ status: "completed" }, 60_000).kind, "failed");
  // The REST shape: the clip is a "video" item in a model_output step (output_video is only the SDK's copy).
  const rest = { status: "completed", steps: [{ type: "user_input", content: [{ type: "image", data: "IMG" }] }, { type: "thought" }, { type: "model_output", content: [{ type: "text" }, { type: "video", data: "VID", mime_type: "video/mp4" }] }] };
  assert.deepEqual(nextStep(rest, 60_000), { kind: "done" });
  assert.equal(videoOf(rest)?.data, "VID");
  assert.equal(videoOf({ steps: [{ type: "user_input", content: [{ type: "video", data: "INPUT" }] }] }), null, "an input video is never the output");
  assert.equal(videoOf({ outputs: [{ type: "video", uri: "https://files/y" }] })?.uri, "https://files/y");
  assert.equal(nextStep({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text" }] }] }, 60_000).kind, "failed");
  assert.equal(nextStep({ status: "failed" }, 60_000).kind, "failed");
  const late = nextStep({ status: "in_progress" }, 11 * 60_000, 10 * 60_000);
  assert.equal(late.kind, "failed");
  assert.equal(late.kind === "failed" && late.cancel, true, "a job past the deadline is cancelled");
});

const ok: VideoAsk = { enabled: true, creatorAllows: true, startApproved: true, licenceRoom: 1, estUsd: 0.41, capUsd: 0.5, usedToday: 0, maxPerDay: 3 };

test("caps refuse before anything is called", () => {
  assert.equal(videoRefusal(ok), null);
  assert.match(videoRefusal({ ...ok, enabled: false })!, /off/);
  assert.match(videoRefusal({ ...ok, creatorAllows: false })!, /hasn't allowed video/);
  assert.match(videoRefusal({ ...ok, startApproved: false })!, /approved/);
  assert.match(videoRefusal({ ...ok, licenceRoom: 0 })!, /no render left/);
  assert.match(videoRefusal({ ...ok, estUsd: 0.6 })!, /over the per-video cap/);
  assert.match(videoRefusal({ ...ok, usedToday: 3 })!, /today's video cap/);
  // Defaults: off without the flag and key; 3 a day; $0.50 a clip; a 4 s clip estimated under the cap.
  assert.equal(videoEnabled({}), false);
  assert.equal(videoEnabled({ VIDEO_ENABLED: "true" }), false, "no key, no video");
  assert.equal(videoMaxPerDay({}), 3);
  assert.equal(videoUsdCap({}), 0.5);
  assert.ok(estimateUsd(4, {}) <= 0.5 && estimateUsd(4, {}) > 0.3);
});

const creator = (accountId: string): CreatorView => ({ accountId, terms: { pricePerRender: (4n * 10n ** 22n).toString(), allowedUses: ["FoodDrink"], maxDays: 30, renderCap: 10 }, captureSha256: "ab".repeat(32), active: true, registeredAt: 0 });
const brand: BrandView = { accountId: "b.testnet", escrow: (10n ** 24n).toString(), reserved: "0", maxPerRender: (10n ** 23n).toString(), totalBudget: (10n ** 24n).toString(), spent: "0" };
const ask = { brief: "Morning coffee campaign for a café", use: "FoodDrink" as Use, durationDays: 30, renderCap: 2 };

test("a video campaign leaves out creators who opted out (everyone else is in by default)", () => {
  const r = filterCreators([creator("yes.testnet"), creator("no.testnet")], ask, brand, { needed: true, allows: new Set(["yes.testnet"]) });
  assert.deepEqual(r.eligible.map((e) => e.creator.accountId), ["yes.testnet"]);
  assert.deepEqual(r.ineligible.map((i) => [i.creator.accountId, i.reason]), [["no.testnet", "the creator hasn't allowed video"]]);
  // An image campaign ignores the video setting.
  assert.equal(filterCreators([creator("no.testnet")], ask, brand).eligible.length, 1);
});

test("the sha256 is over the exact stored bytes; non-MP4 refused; blob is a stub", async () => {
  const stored = new Map<string, Uint8Array>();
  const drv = localVideoStorage(async (b) => {
    const s = sha(b);
    stored.set(s, new Uint8Array(b));
    return s;
  });
  const v = mp4();
  const s = await drv.put(v, { creator: "c.testnet", brand: "b.testnet" });
  assert.equal(s, sha(stored.get(s)!));
  assert.deepEqual(stored.get(s), v);
  assert.equal(drv.urlFor(s), `/api/media/${s}`);
  await assert.rejects(drv.put(new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), { creator: "c", brand: "b" }), /isn't an MP4/);
  // A store that kept different bytes is caught.
  const liar = localVideoStorage(async () => "00".repeat(32));
  await assert.rejects(liar.put(mp4(), { creator: "c", brand: "b" }), /don't hash/);
  await assert.rejects(blobStorage().put(mp4(), { creator: "c", brand: "b" }), /not configured/);
  assert.equal(videoStorage(async () => "", "blob").kind, "blob");
  assert.equal(videoStorage(async () => "").kind, "local", "local is the default");
});

test("approval before payment: the agent can only submit a video; only the creator's approve_render pays", () => {
  assert.deepEqual([...AGENT_METHODS].sort(), ["request_licence", "submit_render"]);
  // The code only (comments may mention approve_render, as the header does).
  const src = readFileSync(new URL("../lib/video/jobs.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const called = [...src.matchAll(/agentCall\("([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(called, ["submit_render"], "the video job calls submit_render and nothing else");
  assert.match(src, /face_check: "needs_creator_review"/, "a video is always submitted for the creator's review");
  assert.doesNotMatch(src, /approve_render|approveRender/);
});

test("Verify's in-browser hash of a video file matches the stored sha256", async () => {
  const v = mp4(5000);
  assert.equal(await sha256OfBytes(v), sha(v));
});
