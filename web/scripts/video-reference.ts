// pnpm video:reference <path to the 800x800 original> [--confirm]
//   Stores the owner's video reference photo (lib/profiles.ts OWNER.videoReferenceSha256: the 800x800 original whose
//   crop is the on-chain reference 89a4…) privately in the database's media table (kind 'capture', not public), so the
//   video's start frame is made from it, as likeness-paypal does. Refuses a file whose sha256 differs. Dry run by
//   default; prints only sizes and hashes, never the bytes.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { OWNER } from "../lib/profiles.ts";

const [path, flag] = process.argv.slice(2);

async function main() {
  if (!path) throw new Error("usage: pnpm video:reference <path> [--confirm]");
  const bytes = readFileSync(path);
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== OWNER.videoReferenceSha256) throw new Error(`sha256 ${sha.slice(0, 12)}… isn't the owner's video reference (${OWNER.videoReferenceSha256.slice(0, 12)}…)`);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("not a JPEG");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = neon(process.env.DATABASE_URL);
  const [have] = (await sql.query(`select size, kind, public from media where sha256 = $1`, [sha])) as { size: number; kind: string; public: boolean }[];
  console.log(`reference  ${sha} (${bytes.length} B, image/jpeg) for ${OWNER.accountId}`);
  console.log(`database   ${have ? `already stored (kind ${have.kind}, public ${have.public})` : "not stored yet"}`);
  if (have) return;
  console.log(`would run  insert into media (sha256, mime, bytes, size, kind, creator) values ('${sha.slice(0, 12)}…', 'image/jpeg', <${bytes.length} B>, ${bytes.length}, 'capture', '${OWNER.accountId}') on conflict do nothing`);
  if (flag !== "--confirm") return console.log("DRY RUN: nothing written. Re-run with --confirm.");
  await sql.query(
    `insert into media (sha256, mime, bytes, size, kind, creator) values ($1, 'image/jpeg', decode($2, 'base64'), $3, 'capture', $4) on conflict (sha256) do nothing`,
    [sha, bytes.toString("base64"), bytes.length, OWNER.accountId],
  );
  console.log("stored (private).");
}

main().catch((e) => {
  console.error(`video:reference: ${(e as Error).message}`);
  process.exit(1);
});
