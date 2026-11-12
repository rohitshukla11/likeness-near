/**
 * The AI cost cap: every billed NEAR AI call reserves its price first, against a site-wide and a per-brand daily
 * budget (UTC day, micro-USD), atomically. Over either cap → 429 and no call is made.
 *   NEARAI_DAILY_USD_CAP        whole site per day (default 1.00)
 *   NEARAI_BRAND_DAILY_USD_CAP  one brand per day (default 0.50)
 */
import "server-only";
import { q } from "./db";
import { HttpError } from "./http";

/** List prices (near.ai/models, 12 Nov 2026), micro-USD. A face check without reasoning costs ~$0.0002; 0.004 is a safe ceiling. */
export const PRICE_MICROS = { image: 12_000, faceCheck: 4_000, chat: 4_000 } as const;

const usdMicros = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1e6) : d;
};
export const siteCap = () => usdMicros(process.env.NEARAI_DAILY_USD_CAP, 1_000_000);
export const brandCap = () => usdMicros(process.env.NEARAI_BRAND_DAILY_USD_CAP, 500_000);

async function reserveIn(scope: string, cap: number, micros: number): Promise<boolean> {
  const r = await q<{ usd_micros: string }>(
    `insert into ai_spend (day, scope, calls, usd_micros)
       select (now() at time zone 'utc')::date, $1::text, 1, $2::bigint where $2::bigint <= $3::bigint
     on conflict (day, scope) do update set calls = ai_spend.calls + 1, usd_micros = ai_spend.usd_micros + excluded.usd_micros
       where ai_spend.usd_micros + excluded.usd_micros <= $3::bigint
     returning usd_micros`,
    [scope, micros, cap],
  );
  return r.length > 0;
}

async function refund(scope: string, micros: number) {
  await q(`update ai_spend set calls = calls - 1, usd_micros = usd_micros - $2 where day = (now() at time zone 'utc')::date and scope = $1`, [scope, micros]);
}

/** Reserves one billed call for `brand` or throws 429 (nothing reserved). */
export async function reserveAi(brand: string, what: keyof typeof PRICE_MICROS) {
  const micros = PRICE_MICROS[what];
  if (!(await reserveIn("site", siteCap(), micros))) throw new HttpError(429, "the site's daily AI budget is used up: try again tomorrow (UTC)");
  if (!(await reserveIn(`brand:${brand}`, brandCap(), micros))) {
    await refund("site", micros);
    throw new HttpError(429, "this brand's daily AI budget is used up: try again tomorrow (UTC)");
  }
}

/** Today's spend, for /api/health. */
export async function spendToday(): Promise<{ siteMicros: number; capMicros: number }> {
  const r = await q<{ usd_micros: string }>(`select usd_micros from ai_spend where day = (now() at time zone 'utc')::date and scope = 'site'`);
  return { siteMicros: Number(r[0]?.usd_micros ?? 0), capMicros: siteCap() };
}
