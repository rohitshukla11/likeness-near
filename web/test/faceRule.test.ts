// node --test: the safety screen (lib/ai/faceRule.ts). No identity verdict exists: only the creator confirms it's them.
// The screen looks at the ad alone and fails closed: no valid answer → retry once → still none → dropped; minors or
// sexualised → blocked; more than one face → regenerate once, then dropped.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { safetyRule, SAFETY_SCHEMA, SAFETY_SYSTEM, screenWithRetry, validateSafety, type SafetyAnswer } from "../lib/ai/faceRule.ts";

const a = (o: Partial<SafetyAnswer>): SafetyAnswer => ({ faces_in_ad: 1, issues: [], reason: "one adult", ...o });

test("one adult, nothing unsafe → passed; no valid answer → dropped (fail closed)", () => {
  assert.equal(safetyRule(a({}), false), "passed");
  assert.equal(safetyRule(a({ faces_in_ad: 0, issues: ["no_face"] }), false), "passed", "no identity or face-count gate beyond other people");
  assert.equal(safetyRule(undefined, false), "dropped");
});

test("the screen is asked once more on no valid answer, and only once", async () => {
  const ok = { faces_in_ad: 1, issues: [], reason: "one adult" };
  let n = 0;
  const second = await screenWithRetry(async () => (++n === 1 ? { nope: true } : ok));
  assert.deepEqual([second.answer, second.attempts, n], [ok, 2, 2]);
  n = 0;
  const none = await screenWithRetry(async () => {
    n++;
    throw new Error("timeout");
  });
  assert.deepEqual([none.answer, none.attempts, n, none.error], [undefined, 2, 2, "timeout"]);
  assert.equal(safetyRule(none.answer, false), "dropped");
  n = 0;
  const first = await screenWithRetry(async () => (n++, ok));
  assert.deepEqual([first.attempts, n], [1, 1], "a good first answer isn't asked again");
  await assert.rejects(screenWithRetry(async () => Promise.reject(Object.assign(new Error("cap"), { status: 429 }))), /cap/, "a cost-cap refusal surfaces, it isn't a miss");
});

test("a minor or sexualised content is blocked, whatever else", () => {
  assert.equal(safetyRule(a({ issues: ["appears_minor"] }), false), "blocked");
  assert.equal(safetyRule(a({ issues: ["sexualised"], faces_in_ad: 3 }), true), "blocked");
});

test("other people in the ad: regenerate once, then dropped", () => {
  assert.equal(safetyRule(a({ faces_in_ad: 2 }), false), "regenerate");
  assert.equal(safetyRule(a({ faces_in_ad: 2 }), true), "dropped");
  assert.equal(safetyRule(a({ faces_in_ad: 1 }), true), "passed");
});

test("strict validation: exact keys, known issues, sane counts", () => {
  assert.deepEqual(validateSafety({ faces_in_ad: 1, issues: [], reason: "ok" }), { faces_in_ad: 1, issues: [], reason: "ok" });
  assert.equal(validateSafety({ faces_in_ad: 1, issues: [] }), undefined);
  assert.equal(validateSafety({ faces_in_ad: 1, issues: [], reason: "ok", same_person: "yes" }), undefined, "no identity fields accepted");
  assert.equal(validateSafety({ faces_in_ad: -1, issues: [], reason: "ok" }), undefined);
  assert.equal(validateSafety({ faces_in_ad: 1, issues: ["looks_like_someone"], reason: "ok" }), undefined);
  assert.equal(validateSafety(null), undefined);
});

test("the screen never compares identity: one image, no reference, no same-person field", () => {
  assert.deepEqual(Object.keys(SAFETY_SCHEMA.properties).sort(), ["faces_in_ad", "issues", "reason"]);
  assert.match(SAFETY_SYSTEM, /do not identify anyone/);
  const src = readFileSync(new URL("../lib/ai/faceCheck.ts", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal((src.match(/type: "image_url"/g) ?? []).length, 1, "only the ad is sent");
});
