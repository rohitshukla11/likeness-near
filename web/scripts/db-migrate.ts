// pnpm db:migrate: applies lib/db/schema.sql to the database in DATABASE_URL (web/.env.local). Idempotent.
// Prints table names and counts only; the connection string is never printed.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("db:migrate: DATABASE_URL isn't set (put it in web/.env.local)");
  process.exit(1);
}
const sql = neon(url);
const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(here, "../lib/db/schema.sql"), "utf8")
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");
const statements = schema
  .split(/;\s*\n/)
  .map((s) => s.trim().replace(/;$/, ""))
  .filter(Boolean);

for (const s of statements) await sql.query(s);
const tables = (await sql.query(`select table_name from information_schema.tables where table_schema = 'public' order by table_name`)) as { table_name: string }[];
console.log(`db:migrate: ${statements.length} statements applied; tables: ${tables.map((t) => t.table_name).join(", ")}`);
