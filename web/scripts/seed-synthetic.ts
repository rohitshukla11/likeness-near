// pnpm seed:synthetic [--confirm]
//   Sets up the synthetic demo creators (lib/synthetic.ts). DRY RUN by default: reads the chain and the database, then
//   prints exactly what it would do. With --confirm, for each creator that isn't fully set up:
//     1. create its testnet account, faucet-sponsored (key saved by near-cli to ~/.near-credentials, never printed);
//     2. store its capture in Neon (the public synthetic face as its reference frame; liveness marked synthetic);
//     3. register_creator on the contract, signed by that account, attaching 0.01 NEAR for storage (excess refunded).
//
// pnpm seed:synthetic approve-licence <account> <licence_id> [--confirm]
// pnpm seed:synthetic decline-licence <account> <licence_id> [--confirm]
// pnpm seed:synthetic approve-render  <account> <sha256>     [--confirm]
// pnpm seed:synthetic reject-render   <account> <sha256>     [--confirm]
//   The operator's decision for a synthetic creator (there is no person to consent), signed by its account. Dry run
//   unless --confirm. Only accounts listed in lib/synthetic.ts are accepted.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { SYNTHETIC, type SyntheticCreator } from "../lib/synthetic.ts";

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ID || "likeness-near-rohit.testnet";
const RPC = process.env.NEXT_PUBLIC_NEAR_RPC_URL || "https://rpc.testnet.near.org";
const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const NEAR_BIN = join(homedir(), ".cargo/bin/near");
const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const [cmd, a1, a2] = args.filter((a) => a !== "--confirm");

const yocto = (near: string) => {
  const [i, f = ""] = near.split(".");
  return (BigInt(i!) * 10n ** 24n + BigInt(f.padEnd(24, "0"))).toString();
};

async function rpc(params: object) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: "seed", method: "query", params }) });
  return (await r.json()) as { result?: { result?: number[]; amount?: string }; error?: unknown };
}
const accountExists = async (id: string) => !!(await rpc({ request_type: "view_account", finality: "final", account_id: id })).result;
async function registered(id: string): Promise<boolean> {
  const r = await rpc({ request_type: "call_function", finality: "final", account_id: CONTRACT, method_name: "get_creator", args_base64: Buffer.from(JSON.stringify({ account_id: id })).toString("base64") });
  return !!r.result?.result && JSON.parse(Buffer.from(r.result.result).toString()) !== null;
}

/** near-cli, output filtered to status lines only (never keys). */
function near(argv: string[]) {
  // near-cli writes its status to stderr: read both streams, print only the status lines.
  const r = spawnSync(NEAR_BIN, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const out = `${r.stdout}\n${r.stderr}`;
  if (r.status !== 0) throw new Error(`near-cli exited ${r.status}: ${out.split("\n").filter((l) => /Error|error/.test(l) && !/ed25519:/.test(l)).slice(0, 3).join(" | ")}`);
  for (const l of out.replace(/\x1b\[[0-9;]*m/g, "").split("\n")) if (/Transaction ID|successfully|created|succeeded|Error|error/.test(l) && !/ed25519:[1-9A-HJ-NP-Za-km-z]{60,}/.test(l)) console.log(`    ${l.trim()}`);
}
const show = (argv: string[]) => `near ${argv.map((x) => (/[\s{}"',]/.test(x) ? `'${x}'` : x)).join(" ")}`;

const createArgs = (s: SyntheticCreator) => ["account", "create-account", "sponsor-by-faucet-service", s.accountId, "autogenerate-new-keypair", "save-to-legacy-keychain", "network-config", "testnet", "create"];
const callArgs = (signer: string, method: string, json: object, depositNear = "0", tgas = 30) => [
  "contract", "call-function", "as-transaction", CONTRACT, method, "json-args", JSON.stringify(json),
  "prepaid-gas", `${tgas}.0 Tgas`, "attached-deposit", `${depositNear} NEAR`, "sign-as", signer, "network-config", "testnet", "sign-with-legacy-keychain", "send",
];

async function seed() {
  const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
  console.log(`${confirm ? "SEEDING" : "DRY RUN (nothing is sent or written)"}: ${SYNTHETIC.length} synthetic demo creators on ${CONTRACT}\n`);
  let deposits = 0;
  for (const s of SYNTHETIC) {
    const bytes = new Uint8Array(readFileSync(join(WEB, "public", s.face)));
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== s.faceSha256) throw new Error(`${s.face}: sha256 ${sha} doesn't match lib/synthetic.ts`);
    const exists = await accountExists(s.accountId);
    const isReg = exists && (await registered(s.accountId));
    const hasCap = sql ? (await sql.query(`select 1 from captures where creator = $1 and front_sha256 = $2`, [s.accountId, sha])).length > 0 : false;
    const terms = { price_per_render: yocto(s.terms.pricePerRenderNear), allowed_uses: s.terms.allowedUses, max_days: s.terms.maxDays, render_cap: s.terms.renderCap };
    console.log(`${s.name} (synthetic demo creator, ${s.niche}) → ${s.accountId}\n  "${s.bio}"`);
    console.log(`  1. account:  ${exists ? "exists ✓" : `create (faucet-sponsored, free): ${show(createArgs(s))}`}`);
    console.log(`  2. capture:  ${hasCap ? "stored ✓" : sql ? `store ${s.face} (${bytes.length} B, sha256 ${sha.slice(0, 12)}…) in Neon as its reference frame (liveness: synthetic)` : "DATABASE_URL not set: can't check or store"}`);
    const reg = callArgs(s.accountId, "register_creator", { terms, capture_sha256: sha }, "0.01");
    console.log(`  3. register: ${isReg ? "registered ✓" : `${show(reg)}`}`);
    console.log(`     terms: ${s.terms.pricePerRenderNear} NEAR per render, ${s.terms.allowedUses.join("/")}, ≤ ${s.terms.maxDays} days, cap ${s.terms.renderCap}`);
    if (!isReg) deposits += 1;
    if (!confirm) continue;
    if (!exists) near(createArgs(s));
    if (!hasCap && sql) {
      await sql.query(`insert into media (sha256, mime, bytes, size, kind, creator) values ($1, 'image/jpeg', decode($2, 'base64'), $3, 'capture', $4) on conflict (sha256) do nothing`, [sha, Buffer.from(bytes).toString("base64"), bytes.length, s.accountId]);
      await sql.query(
        `insert into captures (creator, front_sha256, left_sha256, right_sha256, liveness) values ($1, $2, $2, $2, $3)
         on conflict (creator) do update set front_sha256 = excluded.front_sha256, left_sha256 = excluded.left_sha256, right_sha256 = excluded.right_sha256, liveness = excluded.liveness`,
        [s.accountId, sha, JSON.stringify({ synthetic: true, note: "AI-generated face, not a real person" })],
      );
      console.log("    capture stored");
    }
    if (!isReg) near(reg);
  }
  console.log(`\nNEAR: ${deposits} × 0.01 NEAR storage deposit (from each faucet-funded account; excess refunded) + gas ≈ 0.003 NEAR. No AI calls.`);
  if (!confirm) console.log("Re-run with --confirm to send these transactions and write the captures.");
}

async function decide() {
  const s = SYNTHETIC.find((x) => x.accountId === a1);
  if (!s || !a2) throw new Error("usage: seed:synthetic approve-licence|decline-licence|approve-render|reject-render <synthetic account> <licence_id|sha256> [--confirm]");
  const method = { "approve-licence": "approve_licence", "decline-licence": "decline_licence", "approve-render": "approve_render", "reject-render": "reject_render" }[cmd!]!;
  const json = method.endsWith("licence") ? { licence_id: a2 } : { sha256: a2 };
  const argv = callArgs(s.accountId, method, json, "0", method === "approve_render" ? 60 : 30);
  console.log(`The operator decides for ${s.name} (synthetic demo creator; no real person): ${method}(${JSON.stringify(json)})`);
  console.log(`  ${show(argv)}`);
  if (!confirm) return console.log("DRY RUN: nothing sent. Re-run with --confirm.");
  near(argv);
}

(cmd && cmd !== "seed" ? decide() : seed()).catch((e) => {
  console.error(`seed:synthetic: ${(e as Error).message.split("\n")[0]}`);
  process.exit(1);
});
