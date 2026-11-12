#!/bin/sh
# The brand's agent key, with near-cli-rs (the fallback when a wallet won't sign AddKey/DeleteKey). Dry run by default.
#
#   scripts/agent-key.sh add    <brand.testnet> <ed25519:PUBLIC_KEY> [--confirm]
#   scripts/agent-key.sh delete <brand.testnet> <ed25519:PUBLIC_KEY> [--confirm]
#   scripts/agent-key.sh list   <brand.testnet>
#
# The key may call only request_licence and submit_render on the contract (CONTRACT_ID, default
# likeness-near-rohit.testnet), can't attach deposits, and has a 0.25 NEAR gas allowance. Signed by the brand's own
# key in ~/.near-credentials. Only a public key is ever passed here.
set -eu
CONTRACT_ID=${CONTRACT_ID:-likeness-near-rohit.testnet}
ACTION=${1:-}; BRAND=${2:-}; PK=${3:-}
CONFIRM=0; for a in "$@"; do [ "$a" = "--confirm" ] && CONFIRM=1; done
case "$BRAND" in *.testnet) ;; *) echo "usage: $0 add|delete|list <brand.testnet> [ed25519:PUBLIC_KEY] [--confirm]" >&2; exit 2 ;; esac

case "$ACTION" in
  list)
    exec near account list-keys "$BRAND" network-config testnet now ;;
  add)
    case "$PK" in ed25519:*) ;; *) echo "a public key looks like ed25519:..." >&2; exit 2 ;; esac
    set -- near account add-key "$BRAND" grant-function-call-access --allowance '0.25 NEAR' \
      --contract-account-id "$CONTRACT_ID" --function-names 'request_licence, submit_render' \
      use-manually-provided-public-key "$PK" network-config testnet sign-with-legacy-keychain send ;;
  delete)
    case "$PK" in ed25519:*) ;; *) echo "a public key looks like ed25519:..." >&2; exit 2 ;; esac
    set -- near account delete-keys "$BRAND" public-keys "$PK" network-config testnet sign-with-legacy-keychain send ;;
  *)
    echo "usage: $0 add|delete|list <brand.testnet> [ed25519:PUBLIC_KEY] [--confirm]" >&2; exit 2 ;;
esac

echo "command: $*"
if [ "$CONFIRM" != 1 ]; then
  echo "DRY RUN: nothing sent. Re-run with --confirm."
  exit 0
fi
"$@"
