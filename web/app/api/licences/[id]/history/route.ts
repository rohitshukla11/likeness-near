/**
 * GET /api/licences/<id>/history: the licence's on-chain transactions this app recorded, public (no sign-in): the
 * agent's request, each submit_render, and the creator's decisions, newest first. Only facts that are already public
 * on-chain are returned (tx hashes, the ad's sha256, what kind of call it was); never the ad, its prompt or the
 * agent's notes. A licence created outside this app has no rows here; the contract is still the source of truth.
 */
import { HttpError, json, route } from "@/lib/http";
import { q } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import type { LicenceHistoryItem } from "@/lib/types";


export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await rateLimit(req, "read");
  const id = (await ctx.params).id;
  if (!/^\d{1,19}$/.test(id)) throw new HttpError(400, "a licence id is a number");
  const rows = await q<LicenceHistoryItem>(
    `select at, kind, tx, sha256 from (
       select at::text as at, (case when kind = 'submit' then 'submit' else 'request' end) as kind, tx, sha256
         from activity where licence_id = $1 and tx is not null and kind in ('request', 'submit')
       union all
       select created_at::text, 'decision', decision_tx, sha256 from renders where licence_id = $1 and decision_tx is not null
     ) h order by at desc limit 50`,
    [id],
  );
  // Per ad: were both the image model and the safety screen TEE-verified when it was made?
  const shas = [...new Set(rows.map((r) => r.sha256).filter((s): s is string => !!s))];
  const tee = shas.length
    ? await q<{ sha256: string; ok: boolean }>(
        `select sha256, (provenance->'tee'->>'verified' = 'true' and face_check->'tee'->>'verified' = 'true') as ok from renders where sha256 = any($1)`,
        [shas],
      )
    : [];
  const ok = new Map(tee.map((t) => [t.sha256, t.ok === true]));
  return json({ items: rows.map((r) => (r.sha256 && r.kind === "submit" ? { ...r, tee: ok.get(r.sha256) ?? false } : r)) });
});
