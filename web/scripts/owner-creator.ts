// pnpm owner:creator [--confirm]
//   Sets up the demo's one real creator, the owner (lib/profiles.ts): his photo (public/creators/rohit.jpg, published
//   with his consent) becomes his reference in Neon, the image every ad of him is edited from and checked against.
//   DRY RUN by default: reads the database and the chain, prints what it would do. With --confirm it writes the two
//   Neon rows (media + captures). It never signs anything: register_creator is one transaction the owner signs in his
//   own wallet from the dashboard ("Register as the creator on NEAR").
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { OWNER } from "../lib/profiles.ts";

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ID || "likeness-near-rohit.testnet";
const RPC = process.env.NEXT_PUBLIC_NEAR_RPC_URL || "https://rpc.testnet.near.org";
const WEB = join(dirname(fileURLToPath(import.meta.url)), "..");
const confirm = process.argv.includes("--confirm");

async function onChain(): Promise<{ capture_sha256: string | null } | null> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "owner",
      method: "query",
      params: { request_type: "call_function", finality: "final", account_id: CONTRACT, method_name: "get_creator", args_base64: Buffer.from(JSON.stringify({ account_id: OWNER.accountId })).toString("base64") },
    }),
  });
  const j = (await r.json()) as { result?: { result?: number[] } };
  if (!j.result?.result) throw new Error("couldn't read get_creator from the contract");
  return JSON.parse(Buffer.from(j.result.result).toString()) as { capture_sha256: string | null } | null;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (.env.local)");
  const sql = neon(process.env.DATABASE_URL);
  const bytes = new Uint8Array(readFileSync(join(WEB, "public", OWNER.face)));
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== OWNER.faceSha256) throw new Error(`${OWNER.face}: sha256 ${sha} doesn't match lib/profiles.ts`);
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) throw new Error(`${OWNER.face} isn't a JPEG`);
  const cap = (await sql.query(`select front_sha256 from captures where creator = $1`, [OWNER.accountId])) as { front_sha256: string }[];
  const reg = await onChain();

  console.log(`${confirm ? "WRITING" : "DRY RUN (nothing is written)"}: ${OWNER.name} → ${OWNER.accountId} on ${CONTRACT}\n`);
  const same = cap[0]?.front_sha256 === sha;
  console.log(
    `  1. reference in Neon: ${same ? "stored ✓" : `${cap[0] ? `replace the current one (${cap[0].front_sha256.slice(0, 12)}…) with` : "store"} ${OWNER.face} (${bytes.length} B, sha256 ${sha.slice(0, 12)}…): one media row (kind capture) + one captures row`}`,
  );
  console.log(
    `  2. register_creator: ${reg ? `registered ✓ (capture ${reg.capture_sha256 ? `${reg.capture_sha256.slice(0, 12)}…${reg.capture_sha256 === sha ? "" : " — differs from this photo"}` : "none"})` : `not yet: sign it in your wallet from the dashboard (${OWNER.terms.pricePerRenderNear} NEAR per render, ${OWNER.terms.allowedUses.join("/")}, ≤ ${OWNER.terms.maxDays} days, cap ${OWNER.terms.renderCap}; 0.01 NEAR storage deposit, excess refunded)`}`,
  );
  if (!confirm) return console.log("\nRe-run with --confirm to write the Neon rows.");
  if (same) return console.log("\nNothing to write.");
  await sql.query(`insert into media (sha256, mime, bytes, size, kind, creator) values ($1, 'image/jpeg', decode($2, 'base64'), $3, 'capture', $4) on conflict (sha256) do nothing`, [
    sha,
    Buffer.from(bytes).toString("base64"),
    bytes.length,
    OWNER.accountId,
  ]);
  await sql.query(
    `insert into captures (creator, front_sha256, left_sha256, right_sha256, liveness) values ($1, $2, $2, $2, $3)
     on conflict (creator) do update set front_sha256 = excluded.front_sha256, left_sha256 = excluded.left_sha256, right_sha256 = excluded.right_sha256, liveness = excluded.liveness, consent_at = now()`,
    [OWNER.accountId, sha, JSON.stringify({ ownerPhoto: true, note: "photo supplied by the account owner, of himself, published with his consent" })],
  );
  console.log("\nStored.");
}

main().catch((e) => {
  console.error(`owner:creator: ${(e as Error).message.split("\n")[0]}`);
  process.exit(1);
});
