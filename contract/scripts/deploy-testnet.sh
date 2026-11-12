#!/bin/sh
# Deploys the built wasm to a TESTNET account and calls new(owner_id). Dry run by default: prints what it would send.
#
#   scripts/deploy-testnet.sh                 dry run (no transaction)
#   scripts/deploy-testnet.sh --confirm       deploy + init (signs with the key in ~/.near-credentials)
#   scripts/deploy-testnet.sh --confirm --no-init   redeploy code only (state kept; only if the state layout is unchanged)
#
# CONTRACT_ID defaults to likeness-near-rohit.testnet; OWNER_ID defaults to the contract account.
set -eu
cd "$(dirname "$0")/.."
CONTRACT_ID=${CONTRACT_ID:-likeness-near-rohit.testnet}
OWNER_ID=${OWNER_ID:-$CONTRACT_ID}
WASM=target/near/likeness_contract.wasm
CONFIRM=0; INIT=1
for a in "$@"; do
  case "$a" in
    --confirm) CONFIRM=1 ;;
    --no-init) INIT=0 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

case "$CONTRACT_ID" in *.testnet) ;; *) echo "refusing: $CONTRACT_ID is not a .testnet account" >&2; exit 1 ;; esac
[ -f "$WASM" ] || { echo "no $WASM: run scripts/build.sh first" >&2; exit 1; }

BYTES=$(wc -c < "$WASM" | tr -d ' ')
SHA=$(shasum -a 256 "$WASM" | cut -d' ' -f1)
echo "contract : $CONTRACT_ID (testnet)"
echo "owner    : $OWNER_ID"
echo "wasm     : $WASM, $BYTES bytes, sha256 $SHA"
echo "storage  : ~$(echo "scale=2; $BYTES / 100000" | bc) NEAR locked for the code (1e-5 NEAR per byte)"

if [ "$INIT" = 1 ]; then
  set -- near contract deploy "$CONTRACT_ID" use-file "$WASM" with-init-call new json-args "{\"owner_id\":\"$OWNER_ID\"}" \
    prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-legacy-keychain send
else
  set -- near contract deploy "$CONTRACT_ID" use-file "$WASM" without-init-call network-config testnet sign-with-legacy-keychain send
fi
echo "command  : $*"

if [ "$CONFIRM" != 1 ]; then
  echo "DRY RUN: nothing sent. Re-run with --confirm to deploy."
  exit 0
fi
"$@"
