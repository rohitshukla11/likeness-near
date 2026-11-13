// pnpm video:dry <licenceId> <approved ad sha256>
//   The dry run for a video ad: what POST /api/agent/video would send, and whether the caps let it. Reads the chain
//   and the database only; never calls the video model, never prints a key. The first paid video needs Rohit's
//   "confirm" after this.
import { neon } from "@neondatabase/serverless";
import { estimateUsd, VIDEO_ASPECT, VIDEO_LABEL, VIDEO_PROVIDER, VIDEO_RESOLUTION, VIDEO_SECONDS, videoEnabled, videoMaxPerDay, videoModel, videoStorageKind, videoUsdCap } from "../lib/video/config.ts";
import { videoRefusal } from "../lib/video/caps.ts";
import { videoPrompt } from "../lib/video/prompt.ts";

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ID || "likeness-near-rohit.testnet";
const RPC = process.env.NEXT_PUBLIC_NEAR_RPC_URL || "https://rpc.testnet.near.org";
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

async function main() {
  if (!licenceId || !/^\d+$/.test(licenceId) || !fromSha || !/^[0-9a-f]{64}$/.test(fromSha)) throw new Error("usage: pnpm video:dry <licenceId> <approved ad sha256>");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = neon(process.env.DATABASE_URL);
  const [l, receipt] = await Promise.all([
    view<{ creator: string; brand: string; status: string; render_cap: number; renders_used: number; renders_reserved: number } | null>("get_licence", { licence_id: licenceId }),
    view<{ status: string; licence_id: string } | null>("get_receipt", { sha256: fromSha }),
  ]);
  if (!l) throw new Error(`no licence ${licenceId}`);
  const [media] = (await sql.query(`select mime, size from media where sha256 = $1`, [fromSha])) as { mime: string; size: number }[];
  const [camp] = (await sql.query(`select scene, product from campaigns where licence_id = $1 order by id desc limit 1`, [licenceId])) as { scene: string; product: string }[];
  const [opt] = (await sql.query(`select allow_video from creator_settings where account = $1`, [l.creator])) as { allow_video: boolean }[];
  const [today] = (await sql.query(
    `select count(*)::int as n from video_jobs where status in ('starting','running','storing','submitted') and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'`,
  )) as { n: number }[];
  const est = estimateUsd(VIDEO_SECONDS);
  const refusal = videoRefusal({
    enabled: videoEnabled(),
    creatorAllows: !!opt?.allow_video,
    startApproved: receipt?.status === "Approved" && receipt.licence_id === licenceId && !!media && media.mime !== "video/mp4",
    licenceRoom: l.render_cap - l.renders_used - l.renders_reserved,
    estUsd: est,
    capUsd: videoUsdCap(),
    usedToday: today?.n ?? 0,
    maxPerDay: videoMaxPerDay(),
  });
  const scene = camp?.scene || "<the agent writes it first>";
  const product = camp?.product || "<the agent writes it first>";

  console.log(`DRY RUN (no call to the video model): a video ad for licence ${licenceId} (${l.creator} ← ${l.brand}, ${l.status})\n`);
  console.log(`provider ${VIDEO_PROVIDER}, model ${videoModel()} (outside NEAR AI's TEE)`);
  console.log(`clip     ${VIDEO_SECONDS} s, ${VIDEO_RESOLUTION}, ${VIDEO_ASPECT}, no audio, background job polled every 5 s`);
  console.log(`start    approved ad ${fromSha.slice(0, 12)}… (${media ? `${media.mime}, ${media.size} B` : "not in the database"}; receipt ${receipt?.status ?? "none"})`);
  console.log(`prompt   ${videoPrompt(scene, product).split("\n").join("\n         ")}`);
  console.log(`label    "${VIDEO_LABEL}" (player overlay + receipt; the clip is never re-encoded)`);
  console.log(`storage  ${videoStorageKind()} (sha256 over the stored bytes → submit_render, face_check needs_creator_review)`);
  console.log(`cost     ≈ $${est.toFixed(3)} (cap $${videoUsdCap().toFixed(2)} per video); today ${today?.n ?? 0} of ${videoMaxPerDay()}`);
  console.log(`licence  ${l.renders_used} used + ${l.renders_reserved} reserved of ${l.render_cap}; creator opted in: ${opt?.allow_video ? "yes" : "no"}`);
  console.log(`\n${refusal ? `WOULD BE REFUSED: ${refusal}` : "Would start. Nothing is billed until you confirm and press the button in the app."}`);
}

main().catch((e) => {
  console.error(`video:dry: ${(e as Error).message}`);
  process.exit(1);
});
