#!/bin/sh
# Read-only checks against the deployed contract (no transactions, no keys): metadata, supply, creators, and verify of a
# hash nobody submitted (must be Unknown).
set -eu
CONTRACT_ID=${CONTRACT_ID:-likeness-near-rohit.testnet}
view() { near contract call-function as-read-only "$CONTRACT_ID" "$1" json-args "$2" network-config testnet now; }
view nft_metadata '{}'
view nft_total_supply '{}'
view list_creators '{"from_index":0,"limit":5}'
view verify "{\"sha256\":\"$(printf '0%.0s' $(seq 1 64))\"}"
