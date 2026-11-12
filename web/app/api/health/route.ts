/**
 * GET /api/health: what's connected, with no secrets (presence of keys only, never values).
 */
import { json, route } from "@/lib/http";
import { dbConfigured, q } from "@/lib/db";
import { spendToday } from "@/lib/costcap";
import { CONTRACT_ID, contractConfigured } from "@/lib/near/config";
import { viewCall } from "@/lib/near/view";

export const GET = route(async () => {
  let db: "ok" | "not configured" | "error" = "not configured";
  let aiSpend: { siteMicros: number; capMicros: number } | null = null;
  if (dbConfigured()) {
    try {
      await q("select 1");
      db = "ok";
      aiSpend = await spendToday().catch(() => null);
    } catch {
      db = "error";
    }
  }
  let contract: "ok" | "not configured" | "error" = "not configured";
  if (contractConfigured()) contract = await viewCall("nft_total_supply").then(() => "ok" as const, () => "error" as const);
  return json({
    db,
    contract,
    contractId: CONTRACT_ID || null,
    nearAiKey: !!process.env.NEARAI_API_KEY,
    agentKey: !!process.env.AGENT_PRIVATE_KEY,
    sessionSecret: !!process.env.SESSION_SECRET,
    aiSpend,
  });
});
