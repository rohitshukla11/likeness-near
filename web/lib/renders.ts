/**
 * An ad as the pages see it: our record (prompt, the advisory check, transactions) joined with the contract's receipt
 * and licence, which are the authority for status and money.
 */
import "server-only";
import type { RenderRow } from "./db/records";
import { views } from "./near/view";
import type { LicenceView, RenderItem } from "./types";

export async function toRenderItem(row: RenderRow, licences?: Map<string, LicenceView>): Promise<RenderItem | null> {
  const [receipt, licence] = await Promise.all([views.getReceipt(row.sha256), licences?.get(row.licence_id) ?? views.getLicence(row.licence_id)]);
  if (!receipt || !licence) return null; // not (yet) on-chain: never shown as if it were
  return {
    receipt,
    licence,
    mediaUrl: `/api/media/${row.sha256}`,
    faceCheck: row.face_check,
    prompt: row.prompt,
    decisionTx: row.decision_tx,
  };
}

export async function toRenderItems(rows: RenderRow[], licences: LicenceView[]): Promise<RenderItem[]> {
  const byId = new Map(licences.map((l) => [l.id, l]));
  return (await Promise.all(rows.map((r) => toRenderItem(r, byId)))).filter((x): x is RenderItem => x !== null);
}
