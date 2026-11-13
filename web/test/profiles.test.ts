// node --test: the owner (the demo's one real creator) and the public profiles.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { displayName, isOwner, OWNER, profileOf } from "../lib/profiles.ts";
import { parseNear, termsProblem } from "../lib/rules.ts";

test("the owner's photo hashes to the capture_sha256 he registers with", () => {
  const bytes = readFileSync(new URL(`../public${OWNER.face}`, import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), OWNER.faceSha256);
  assert.ok(bytes[0] === 0xff && bytes[1] === 0xd8, "a JPEG");
  const t = OWNER.terms;
  assert.equal(termsProblem({ pricePerRender: parseNear(t.pricePerRenderNear)!, allowedUses: t.allowedUses, maxDays: t.maxDays, renderCap: t.renderCap }), undefined);
});

test("only the owner has a creator side; profiles are the owner and the synthetic creators", () => {
  assert.equal(isOwner("rohitshukla.testnet"), true);
  assert.equal(isOwner("someone-else.testnet"), false);
  assert.equal(profileOf(OWNER.accountId)?.synthetic, false);
  assert.equal(profileOf("likeness-synth-maya.testnet")?.synthetic, true);
  assert.equal(profileOf("someone-else.testnet"), undefined);
  assert.equal(displayName(OWNER.accountId), "Rohit Shukla");
  assert.equal(displayName("likeness-synth-asha.testnet"), "Asha (synthetic demo creator)");
  assert.equal(displayName("someone-else.testnet"), "someone-else.testnet");
});
