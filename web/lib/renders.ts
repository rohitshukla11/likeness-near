/**
 * An ad as the pages see it: our record (prompt, the advisory check, transactions) joined with the contract's receipt
 * and licence, which are the authority for status and money.
 */
import "server-only";
import type { RenderRow } from "./db/records";
import { views } from "./near/view";
import type { LicenceView, RenderItem, RenderTee, TeeSummaryView } from "./types";

/** The attestation summaries stored with a render (provenance.tee for the image model, face_check.tee for the screen). */
export function renderTee(row: Pick<RenderRow, "provenance" | "face_check">): RenderTee {
  const pick = (v: unknown): TeeSummaryView | null => (v && typeof v === "object" && "verified" in v ? (v as TeeSummaryView) : null);
  return { image: pick((row.provenance as Record<string, unknown> | null)?.tee), screen: pick((row.face_check as unknown as Record<string, unknown> | null)?.tee) };
}

export async function toRenderItem(row: RenderRow, licences?: Map<string, LicenceView>): Promise<RenderItem | null> {
  const [receipt, licence] = await Promise.all([views.getReceipt(row.sha256), licences?.get(row.licence_id) ?? views.getLicence(row.licence_id)]);
  if (!receipt || !licence) return null; // not (yet) on-chain: never shown as if it were
  return {
    receipt,
    licence,
    mediaUrl: `/api/media/${row.sha256}`,
    mime: typeof row.provenance?.mime === "string" ? row.provenance.mime : "image/jpeg",
    faceCheck: row.face_check,
    prompt: row.prompt,
    decisionTx: row.decision_tx,
    tee: renderTee(row),
  };
}

export async function toRenderItems(rows: RenderRow[], licences: LicenceView[]): Promise<RenderItem[]> {
  const byId = new Map(licences.map((l) => [l.id, l]));
  return (await Promise.all(rows.map((r) => toRenderItem(r, byId)))).filter((x): x is RenderItem => x !== null);
}
