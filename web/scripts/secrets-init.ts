// pnpm secrets:init <brand.testnet> [--rotate-agent]
// Writes the server's secrets into web/.env.local (mode 600, gitignored), never to stdout:
// - SESSION_SECRET (48 random bytes) if it's missing;
// - AGENT_ACCOUNT_ID=<brand> and a NEW ed25519 AGENT_PRIVATE_KEY if there's none yet (or with --rotate-agent).
// Prints only the agent's PUBLIC key: the brand adds it with one AddKey (the app's brand page, or
// contract/scripts/agent-key.sh). Copy the same values into the host's env yourself; this script never uploads them.
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KeyPair, type KeyPairString } from "near-api-js";

const brand = process.argv[2] ?? "";
if (!/^[a-z0-9._-]+\.testnet$/.test(brand)) {
  console.error("usage: pnpm secrets:init <brand>.testnet [--rotate-agent]");
  process.exit(2);
}
const rotate = process.argv.includes("--rotate-agent");
const file = join(dirname(fileURLToPath(import.meta.url)), "../.env.local");
const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n").filter((l) => l !== "") : [];
const get = (k: string) => lines.find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1) ?? "";
const set = (k: string, v: string) => {
  const i = lines.findIndex((l) => l.startsWith(`${k}=`));
  if (i >= 0) lines[i] = `${k}=${v}`;
  else lines.push(`${k}=${v}`);
};

const done: string[] = [];
if (get("SESSION_SECRET").length < 32) {
  set("SESSION_SECRET", randomBytes(48).toString("base64url"));
  done.push("SESSION_SECRET created");
}
let key = get("AGENT_PRIVATE_KEY");
if (!/^ed25519:/.test(key) || rotate || get("AGENT_ACCOUNT_ID") !== brand) {
  key = KeyPair.fromRandom("ed25519").toString();
  set("AGENT_PRIVATE_KEY", key);
  done.push(rotate ? "agent key rotated" : "agent key created");
}
set("AGENT_ACCOUNT_ID", brand);
writeFileSync(file, `${lines.join("\n")}\n`, { mode: 0o600 });
chmodSync(file, 0o600);

console.log(done.length ? done.join("; ") : "nothing to create");
console.log(`agent account: ${brand}`);
console.log(`agent PUBLIC key (add it with one AddKey): ${KeyPair.fromString(key as KeyPairString).getPublicKey().toString()}`);
