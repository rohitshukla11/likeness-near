#!/bin/sh
# Checks against the deployed contract.
#
#   scripts/smoke.sh                                   read-only: metadata, supply, creators, verify of an unknown hash
#   NEG_SIGNER=<acct>.testnet scripts/smoke.sh --confirm-negative
#       also sends ONE transaction from NEG_SIGNER (any account with a key in ~/.near-credentials that is NOT the
#       contract) calling the #[private] callback on_payout, and passes only if the contract refuses it.
set -eu
CONTRACT_ID=${CONTRACT_ID:-likeness-near-rohit.testnet}
view() { near contract call-function as-read-only "$CONTRACT_ID" "$1" json-args "$2" network-config testnet now; }
view nft_metadata '{}'
view nft_total_supply '{}'
view list_creators '{"from_index":0,"limit":5}'
view verify "{\"sha256\":\"$(printf '0%.0s' $(seq 1 64))\"}"

case " $* " in *" --confirm-negative "*) ;; *) echo "read-only checks done (negative check skipped: pass --confirm-negative with NEG_SIGNER)"; exit 0 ;; esac

NEG_SIGNER=${NEG_SIGNER:-}
[ -n "$NEG_SIGNER" ] || { echo "set NEG_SIGNER to a testnet account with a local key (not the contract)" >&2; exit 2; }
[ "$NEG_SIGNER" != "$CONTRACT_ID" ] || { echo "NEG_SIGNER must not be the contract account (it would pass #[private])" >&2; exit 2; }
echo "negative check: $NEG_SIGNER calls the private callback on_payout (must be refused)"
OUT=$(near contract call-function as-transaction "$CONTRACT_ID" on_payout json-args "{\"creator\":\"$NEG_SIGNER\",\"amount\":\"1\"}" \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' sign-as "$NEG_SIGNER" network-config testnet sign-with-legacy-keychain send 2>&1 || true)
if echo "$OUT" | grep -q "is private"; then
  echo "PASS: the contract refused it (Method on_payout is private)"
else
  echo "FAIL: the private callback was not refused as expected:" >&2
  echo "$OUT" | tail -15 >&2
  exit 1
fi
