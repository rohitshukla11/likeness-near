#!/bin/sh
# Builds the contract wasm with cargo-near on this machine (no Docker, so not a reproducible build; fine for testnet),
# after the unit tests pass. Output: contract/target/near/likeness_contract.wasm, with its sha256.
set -eu
cd "$(dirname "$0")/.."
cargo test --quiet
cargo near build non-reproducible-wasm --no-abi --locked
WASM=target/near/likeness_contract.wasm
echo "wasm: $WASM ($(wc -c < "$WASM" | tr -d ' ') bytes)"
echo "sha256: $(shasum -a 256 "$WASM" | cut -d' ' -f1)"
