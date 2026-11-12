/**
 * The bytes that get stored, served, hashed and submitted are the FINAL bytes: after the label step (if any). The
 * sha256 is computed here, once, over exactly those bytes, so receipt hash = stored bytes = served bytes (decision 6).
 * No imports besides node:crypto: unit-tested in test/finalize.test.ts.
 */
import { createHash } from "node:crypto";

export type LabelStep = (bytes: Uint8Array) => Promise<Uint8Array>;

/** No burned-in label (the page, the receipt and Verify carry "AI-edited from the creator's consented photo"). */
export const noLabel: LabelStep = async (b) => b;

export async function finalize(raw: Uint8Array, label: LabelStep = noLabel): Promise<{ bytes: Uint8Array; sha256: string; labelled: boolean }> {
  const bytes = await label(raw);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { bytes, sha256, labelled: label !== noLabel };
}
