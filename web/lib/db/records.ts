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

/** The creator chosen and the licence requested for a campaign. */
export async function linkCampaign(id: number, creator: string, licenceId: string) {
  await q(`update campaigns set creator = $2, licence_id = $3 where id = $1`, [id, creator, licenceId]);
}

export interface CampaignRow {
  id: string;
  brand: string;
  brief: string;
  usage: string;
  scene: string;
  product: string;
  creator: string | null;
  licence_id: string | null;
}

/** The campaign behind a licence (its scene and product feed the image prompt). */
export async function campaignByLicence(licenceId: string): Promise<CampaignRow | null> {
  const r = await q<CampaignRow>(`select id, brand, brief, usage, scene, product, creator, licence_id from campaigns where licence_id = $1 order by id desc limit 1`, [licenceId]);
  return r[0] ?? null;
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
  status: "generated" | "regenerate" | "blocked" | "mismatch" | "submitted";
  attempt: number;
  retry_of: string | null;
}

const RENDER_COLS = "sha256, licence_id, brand, creator, prompt, face_check, provenance, submit_tx, decision_tx, status, attempt, retry_of";

export async function addRender(r: Omit<RenderRow, "decision_tx" | "face_check"> & { campaign_id?: number | null }) {
  await q(
    `insert into renders (sha256, licence_id, brand, creator, campaign_id, prompt, face_check, provenance, submit_tx, status, attempt, retry_of)
     values ($1, $2, $3, $4, $5, $6, '{}'::jsonb, $7, $8, $9, $10, $11) on conflict (sha256) do nothing`,
    [r.sha256, r.licence_id, r.brand, r.creator, r.campaign_id ?? null, r.prompt, JSON.stringify(r.provenance), r.submit_tx, r.status, r.attempt, r.retry_of],
  );
}

export async function updateRender(sha: string, u: { status: RenderRow["status"]; face_check?: unknown; submit_tx?: string | null }) {
  await q(`update renders set status = $2, face_check = coalesce($3::jsonb, face_check), submit_tx = coalesce($4, submit_tx) where sha256 = $1`, [
    sha,
    u.status,
    u.face_check === undefined ? null : JSON.stringify(u.face_check),
    u.submit_tx ?? null,
  ]);
}

/** How many renders this licence has had (each used a distinct prompt). */
export async function renderCount(licenceId: string): Promise<number> {
  const r = await q<{ n: string }>(`select count(*) as n from renders where licence_id = $1`, [licenceId]);
  return Number(r[0]?.n ?? 0);
}

export async function renderBySha(sha: string): Promise<RenderRow | null> {
  const r = await q<RenderRow>(`select ${RENDER_COLS} from renders where sha256 = $1`, [sha]);
  return r[0] ?? null;
}

export async function rendersFor(who: { creator?: string; brand?: string }, limit = 50): Promise<RenderRow[]> {
  const col = who.creator ? "creator" : "brand";
  return q<RenderRow>(
    `select ${RENDER_COLS} from renders where ${col} = $1 and status = 'submitted' order by created_at desc limit $2`,
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
