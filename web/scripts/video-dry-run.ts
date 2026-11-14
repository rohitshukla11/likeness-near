// pnpm video:dry <licenceId> [approved ad sha256]
//   The dry run for a video ad: what POST /api/agent/video would send, and whether the caps let it. Direct by default
//   (no sha256): the start frame is made by the video module's image model from the creator's reference photo, as likeness-paypal
//   does; with a sha256, that approved ad is the first frame. Reads the chain and the database only; never calls a
//   model, never prints a key. A paid video needs Rohit's "confirm" after this.
import { neon } from "@neondatabase/serverless";
import { estimateUsd, STILL_USD, VIDEO_ASPECT, VIDEO_LABEL, VIDEO_PROVIDER, VIDEO_RESOLUTION, VIDEO_SECONDS, videoEnabled, videoMaxPerDay, videoModel, videoStillModel, videoStorageKind, videoUsdCap } from "../lib/video/config.ts";
import { videoRefusal } from "../lib/video/caps.ts";
import { stillPrompt, videoBrief, videoPrompt } from "../lib/video/prompt.ts";
import { isOwner, OWNER } from "../lib/profiles.ts";

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ID || "likeness-near-rohit.testnet";
const RPC = process.env.NEXT_PUBLIC_NEAR_RPC_URL || "https://rpc.testnet.fastnear.com";
const [licenceId, fromSha] = process.argv.slice(2);

async function view<T>(method: string, args: object): Promise<T> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "dry", method: "query", params: { request_type: "call_function", finality: "final", account_id: CONTRACT, method_name: method, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") } }),
  });
  const j = (await r.json()) as { result?: { result: number[] } };
  if (!j.result) throw new Error(`${method}: no result`);
  return JSON.parse(Buffer.from(j.result.result).toString()) as T;
}

const indent = (s: string) => s.split("\n").join("\n           ");

async function main() {
  if (!licenceId || !/^\d+$/.test(licenceId) || (fromSha && !/^[0-9a-f]{64}$/.test(fromSha))) throw new Error("usage: pnpm video:dry <licenceId> [approved ad sha256]");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = neon(process.env.DATABASE_URL);
  const l = await view<{ creator: string; brand: string; status: string; render_cap: number; renders_used: number; renders_reserved: number } | null>("get_licence", { licence_id: licenceId });
  if (!l) throw new Error(`no licence ${licenceId}`);
  const receipt = fromSha ? await view<{ status: string; licence_id: string } | null>("get_receipt", { sha256: fromSha }) : null;
  const [media] = fromSha ? ((await sql.query(`select mime, size from media where sha256 = $1`, [fromSha])) as { mime: string; size: number }[]) : [];
  // The same choice as lib/video/jobs.ts videoReferenceOf: the owner's 800x800 original, else the registered capture.
  const refSha = isOwner(l.creator)
    ? OWNER.videoReferenceSha256
    : (((await sql.query(`select front_sha256 from captures where creator = $1`, [l.creator])) as { front_sha256: string }[])[0]?.front_sha256 ?? "");
  const [cap] = (await sql.query(`select sha256 as front_sha256, mime, size from media where sha256 = $1`, [refSha])) as { front_sha256: string; mime: string; size: number }[];
  const [camp] = (await sql.query(`select brief, scene, product, to_jsonb(c) ->> 'motion' as motion from campaigns c where licence_id = $1 order by id desc limit 1`, [licenceId])) as { brief: string; scene: string; product: string; motion: string | null }[];
  const [opt] = (await sql.query(`select allow_video from creator_settings where account = $1`, [l.creator])) as { allow_video: boolean }[];
  const [today] = (await sql.query(
    `select count(*)::int as n from video_jobs where status in ('starting','running','storing','submitted') and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'`,
  )) as { n: number }[];
  const est = estimateUsd(VIDEO_SECONDS);
  const refusal = !fromSha && !cap ? "the video reference photo isn't stored yet" : videoRefusal({
    enabled: videoEnabled(),
    creatorAllows: opt?.allow_video !== false,
    startApproved: !fromSha || (receipt?.status === "Approved" && receipt.licence_id === licenceId && !!media && media.mime !== "video/mp4"),
    licenceRoom: l.render_cap - l.renders_used - l.renders_reserved,
    estUsd: est,
    capUsd: videoUsdCap(),
    usedToday: today?.n ?? 0,
    maxPerDay: videoMaxPerDay(),
  });
  const brief = camp?.brief ?? "<no campaign>";
  const scene = camp?.scene || "<the agent writes it first>";
  const product = camp?.product || "<the agent writes it first>";

  console.log(`DRY RUN (no model call): a video ad for licence ${licenceId} (${l.creator} ← ${l.brand}, ${l.status})\n`);
  if (fromSha) {
    console.log(`start      approved ad ${fromSha.slice(0, 12)}… (${media ? `${media.mime}, ${media.size} B` : "not in the database"}; receipt ${receipt?.status ?? "none"})`);
  } else {
    const what = isOwner(l.creator) ? `the 800x800 original (the on-chain reference ${OWNER.faceSha256.slice(0, 12)}… is a crop of it)` : "the registered capture";
    console.log(`reference  ${refSha.slice(0, 12)}…, ${what}: ${cap ? `stored privately (${cap.mime}, ${cap.size} B)` : "NOT STORED YET (pnpm video:reference)"}`);
    console.log(`start      ${videoStillModel()} (not NEAR AI), 16:9 at 1K, ≈ $${STILL_USD.toFixed(4)}; face match (same person, one person; internal retry): one more start frame, then no video`);
    console.log(`  prompt   ${indent(stillPrompt(videoBrief(brief, scene, product)))}`);
    console.log(`screen     the safety screen on the start frame (NEAR AI): blocked / regenerate once / dropped (fail closed)`);
  }
  console.log(`clip       ${VIDEO_PROVIDER}, model ${videoModel()} (not NEAR AI), ${VIDEO_SECONDS} s, ${VIDEO_RESOLUTION}, ${VIDEO_ASPECT}, polled every 5 s`);
  console.log(`  prompt   ${indent(videoPrompt(camp?.motion || brief, scene, product))}`);
  console.log(`label      "${VIDEO_LABEL}" (player overlay + receipt; the clip is never re-encoded)`);
  console.log(`storage    ${videoStorageKind()} (sha256 over the stored bytes → submit_render, needs_creator_review; paid only on the creator's approval)`);
  console.log(`cost       ≈ $${est.toFixed(3)} (start frame + clip; cap $${videoUsdCap().toFixed(2)} per video); today ${today?.n ?? 0} of ${videoMaxPerDay()}`);
  console.log(`licence    ${l.renders_used} used + ${l.renders_reserved} reserved of ${l.render_cap}; creator allows video: ${opt?.allow_video === false ? "no" : "yes (default)"}`);
  console.log(`\n${refusal ? `WOULD BE REFUSED: ${refusal}` : "Would start. Nothing is billed until you confirm."}`);
}

main().catch((e) => {
  console.error(`video:dry: ${(e as Error).message}`);
  process.exit(1);
});
