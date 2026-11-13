// node --test: the synthetic demo creators' registry matches their files and passes the normal rules.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseNear, termsProblem } from "../lib/rules.ts";
import { creatorLabel, isSynthetic, SYNTHETIC, SYNTHETIC_NOTE } from "../lib/synthetic.ts";

test("each face file hashes to the capture_sha256 its account registers", () => {
  for (const s of SYNTHETIC) {
    const bytes = readFileSync(new URL(`../public${s.face}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), s.faceSha256, s.name);
    assert.ok(bytes[0] === 0xff && bytes[1] === 0xd8, `${s.name} is a JPEG`);
  }
});

test("accounts are distinct .testnet ids and terms pass the same validation as real creators", () => {
  assert.equal(new Set(SYNTHETIC.map((s) => s.accountId)).size, SYNTHETIC.length);
  for (const s of SYNTHETIC) {
    assert.match(s.accountId, /^likeness-synth-[a-z]+\.testnet$/);
    const price = parseNear(s.terms.pricePerRenderNear);
    assert.ok(price !== null);
    assert.equal(termsProblem({ pricePerRender: price!, allowedUses: s.terms.allowedUses, maxDays: s.terms.maxDays, renderCap: s.terms.renderCap }), undefined, s.name);
  }
});

test("the synthetic demo creators each have a niche and a bio", () => {
  assert.deepEqual(SYNTHETIC.map((s) => s.name), ["Asha", "Maya Lindqvist"]);
  for (const s of SYNTHETIC) assert.ok(s.niche && s.bio.endsWith("."), s.name);
});

test("labels say synthetic, and only for listed accounts", () => {
  assert.equal(SYNTHETIC_NOTE, "Synthetic demo creator: AI-generated face, not a real person");
  assert.equal(creatorLabel("likeness-synth-asha.testnet"), "Asha (synthetic demo creator)");
  assert.equal(creatorLabel("rohitshukla.testnet"), "rohitshukla.testnet");
  assert.equal(isSynthetic("rohitshukla.testnet"), false);
});
