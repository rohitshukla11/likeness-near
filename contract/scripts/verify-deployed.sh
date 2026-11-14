#!/bin/sh
# Checks that the deployed contract is this source: builds the wasm exactly as scripts/build.sh does, computes its
# code hash the way NEAR reports it (base58 of the wasm's sha256), reads the account's code_hash from public testnet
# RPC (view_account), and exits 0 only if they match.
#   ACCOUNT  default likeness-near-rohit.testnet
#   RPC      default https://rpc.testnet.fastnear.com
# Needs: the Rust toolchain in rust-toolchain.toml, cargo-near, curl, python3.
set -eu
cd "$(dirname "$0")/.."
ACCOUNT="${ACCOUNT:-likeness-near-rohit.testnet}"
RPC="${RPC:-https://rpc.testnet.fastnear.com}"

sh scripts/build.sh
WASM=target/near/likeness_contract.wasm

LOCAL=$(python3 -c '
import hashlib, sys
d = hashlib.sha256(open(sys.argv[1], "rb").read()).digest()
A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
n, s = int.from_bytes(d, "big"), ""
while n:
    n, r = divmod(n, 58)
    s = A[r] + s
print("1" * (len(d) - len(d.lstrip(b"\0"))) + s)
' "$WASM")

BODY=$(printf '{"jsonrpc":"2.0","id":"verify","method":"query","params":{"request_type":"view_account","finality":"final","account_id":"%s"}}' "$ACCOUNT")
DEPLOYED=$(curl -sS --fail --max-time 30 -H 'Content-Type: application/json' -d "$BODY" "$RPC" | python3 -c '
import json, sys
r = json.load(sys.stdin)
if "result" not in r:
    sys.exit("RPC error: " + json.dumps(r.get("error", r))[:300])
print(r["result"]["code_hash"])
')

echo "account:            $ACCOUNT ($RPC)"
echo "local build hash:   $LOCAL"
echo "deployed code_hash: $DEPLOYED"
if [ "$LOCAL" = "$DEPLOYED" ]; then
  echo "MATCH: the deployed contract is this source's build"
else
  echo "MISMATCH: the deployed contract is not this source's build (or a different toolchain built it)"
  exit 1
fi
