// node --test: the sha256 that goes on-chain is computed over the FINAL (labelled) bytes, which are what's stored.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { finalize, noLabel } from "../lib/ai/finalize.ts";

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const raw = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3, 0xff, 0xd9]);

test("without a label step, the hash is over the model's bytes", async () => {
  const f = await finalize(raw, noLabel);
  assert.equal(f.sha256, sha(raw));
  assert.deepEqual(f.bytes, raw);
  assert.equal(f.labelled, false);
});

test("with a label step, the hash is over the labelled bytes, not the raw ones", async () => {
  const label = async (b: Uint8Array) => new Uint8Array([...b, 0x4c, 0x41, 0x42, 0x45, 0x4c]);
  const f = await finalize(raw, label);
  assert.equal(f.labelled, true);
  assert.notEqual(f.sha256, sha(raw));
  assert.equal(f.sha256, sha(f.bytes), "the hash names exactly the bytes that are stored and served");
});
