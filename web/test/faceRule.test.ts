// node --test: the advisory face check's validation and fail-closed rule.
import assert from "node:assert/strict";
import { test } from "node:test";
import { faceRule, validateFace, type FaceAnswer } from "../lib/ai/faceRule.ts";

const a = (o: Partial<FaceAnswer>): FaceAnswer => ({ faces_in_ad: 1, same_person: "yes", confidence: 0.9, issues: [], reason: "ok", ...o });

test("likely_match only with yes, ≥ 0.8, exactly one face and no issues", () => {
  assert.equal(faceRule(a({}), false), "likely_match");
  assert.equal(faceRule(a({ confidence: 0.8 }), false), "likely_match");
  assert.equal(faceRule(a({ confidence: 0.79 }), false), "needs_creator_review");
  assert.equal(faceRule(a({ faces_in_ad: 2 }), false), "needs_creator_review");
  assert.equal(faceRule(a({ faces_in_ad: 0 }), false), "needs_creator_review");
  assert.equal(faceRule(a({ issues: ["low_quality"] }), false), "needs_creator_review", "a spurious issue on a match → review");
  assert.equal(faceRule(a({ same_person: "unclear" }), false), "needs_creator_review");
});

test("minors or sexualised content are blocked, whatever else it says", () => {
  assert.equal(faceRule(a({ issues: ["appears_minor"] }), false), "blocked");
  assert.equal(faceRule(a({ issues: ["sexualised"], same_person: "no", confidence: 1 }), true), "blocked");
});

test("a confident 'no' regenerates once, then it's a mismatch", () => {
  assert.equal(faceRule(a({ same_person: "no", confidence: 1, issues: ["face_occluded"] }), false), "regenerate");
  assert.equal(faceRule(a({ same_person: "no", confidence: 0.85 }), true), "mismatch");
  assert.equal(faceRule(a({ same_person: "no", confidence: 0.5 }), false), "needs_creator_review");
});

test("no answer or an off-schema answer → needs_creator_review", () => {
  assert.equal(faceRule(undefined, false), "needs_creator_review");
  assert.equal(validateFace({ ...a({}), extra: 1 }), undefined);
  assert.equal(validateFace({ faces_in_ad: 1, same_person: "yes", confidence: 0.9, issues: [] }), undefined);
  assert.equal(validateFace(a({ confidence: 1.2 })), undefined);
  assert.equal(validateFace(a({ issues: ["something_else"] })), undefined);
  assert.equal(validateFace(a({ reason: "x".repeat(201) })), undefined);
  assert.equal(validateFace(a({ same_person: "maybe" as never })), undefined);
  assert.deepEqual(validateFace(a({})), a({}));
});
