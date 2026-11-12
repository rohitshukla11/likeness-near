/** Campaigns, renders and the agent's activity log. */
import "server-only";
import { q } from "./index";
import type { ActivityEvent, CampaignRequest, FaceCheckDetail } from "../types";

export async function addCampaign(brand: string, c: CampaignRequest): Promise<number> {
  const r = await q<{ id: string }>(
    `insert into campaigns (brand, brief, usage, duration_days, render_cap, scene, product) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [brand, c.brief, c.use, c.durationDays, c.renderCap, c.scene, c.product],
  );
  return Number(r[0]!.id);
}

export interface RenderRow {
  sha256: string;
  licence_id: string;
  brand: string;
  creator: string;
  prompt: string;
  face_check: FaceCheckDetail;
  provenance: Record<string, unknown>;
  submit_tx: string | null;
  decision_tx: string | null;
}

export async function addRender(r: Omit<RenderRow, "decision_tx"> & { campaign_id?: number | null }) {
  await q(
    `insert into renders (sha256, licence_id, brand, creator, campaign_id, prompt, face_check, provenance, submit_tx)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict (sha256) do nothing`,
    [r.sha256, r.licence_id, r.brand, r.creator, r.campaign_id ?? null, r.prompt, JSON.stringify(r.face_check), JSON.stringify(r.provenance), r.submit_tx],
  );
}

export async function renderBySha(sha: string): Promise<RenderRow | null> {
  const r = await q<RenderRow>(`select sha256, licence_id, brand, creator, prompt, face_check, provenance, submit_tx, decision_tx from renders where sha256 = $1`, [sha]);
  return r[0] ?? null;
}

export async function rendersFor(who: { creator?: string; brand?: string }, limit = 50): Promise<RenderRow[]> {
  const col = who.creator ? "creator" : "brand";
  return q<RenderRow>(
    `select sha256, licence_id, brand, creator, prompt, face_check, provenance, submit_tx, decision_tx from renders where ${col} = $1 order by created_at desc limit $2`,
    [who.creator ?? who.brand, Math.min(limit, 100)],
  );
}

export async function log(brand: string, e: Omit<ActivityEvent, "at">) {
  await q(`insert into activity (brand, kind, summary, licence_id, sha256, tx) values ($1, $2, $3, $4, $5, $6)`, [
    brand,
    e.kind,
    e.summary.slice(0, 500),
    e.licenceId ?? null,
    e.sha256 ?? null,
    e.tx ?? null,
  ]);
}

export async function activity(brand: string, limit = 100): Promise<ActivityEvent[]> {
  const r = await q<{ at: string; kind: ActivityEvent["kind"]; summary: string; licence_id: string | null; sha256: string | null; tx: string | null }>(
    `select at, kind, summary, licence_id, sha256, tx from activity where brand = $1 order by at desc, id desc limit $2`,
    [brand, Math.min(limit, 200)],
  );
  return r.map((x) => ({ at: new Date(x.at).getTime(), kind: x.kind, summary: x.summary, licenceId: x.licence_id, sha256: x.sha256, tx: x.tx }));
}
