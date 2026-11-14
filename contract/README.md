# Likeness contract (NEAR, Rust)

Face licences, escrow and per-render receipts, with non-transferable NEP-171 licence tokens. Testnet only.

## Build and test

```sh
cd contract
cargo test                       # 70 unit tests (incl. the real pre-upgrade testnet state, read by the new code)
scripts/build.sh                 # tests, then cargo near build non-reproducible-wasm --no-abi --locked
```

There is no Docker on the build machine, so the wasm is built with `cargo near build non-reproducible-wasm`: it
works on testnet, but the binary isn't byte-for-byte reproducible from source. The script prints its size and sha256.

## Deploy (testnet)

```sh
scripts/deploy-testnet.sh             # dry run: prints the near-cli-rs command, the wasm sha256 and the storage cost
scripts/deploy-testnet.sh --confirm   # deploys to likeness-near-rohit.testnet and calls new(owner_id)
scripts/deploy-testnet.sh --confirm --no-init   # code-only redeploy (state kept; only when the stored types are unchanged)
scripts/smoke.sh                      # read-only views against the deployed contract
```

## The agent's key

The brand's agent signs with a function-call key on the brand's own account: receiver = this contract, methods
`request_licence` and `submit_render`, allowance 0.25 NEAR, no deposits. The brand adds it from the app (one AddKey in
the wallet) or, if the wallet won't sign it, with:

```sh
scripts/agent-key.sh add    <brand>.testnet ed25519:<AGENT_PUBLIC_KEY>              # dry run
scripts/agent-key.sh add    <brand>.testnet ed25519:<AGENT_PUBLIC_KEY> --confirm
scripts/agent-key.sh delete <brand>.testnet ed25519:<AGENT_PUBLIC_KEY> --confirm    # the kill switch
scripts/agent-key.sh list   <brand>.testnet
```

## Methods

| Who | Method |
|---|---|
| creator (full access) | `register_creator(terms, capture_sha256)` payable (64 zeros = likeness not proven yet) · `set_capture(capture_sha256)` ("prove your likeness" later) · `update_terms(terms)` · `set_active(active)` |
| creator | `approve_licence(licence_id)` (mints the token) · `decline_licence` · `revoke_licence` (releases pending ads) |
| creator | `approve_render(sha256)` (pays the creator, records the receipt) · `reject_render(sha256)` · `claim_unclaimed()` |
| brand (full access) | `deposit()` payable · `set_limits(max_per_render, total_budget)` · `withdraw(amount)` · `cancel_licence_request(licence_id)` |
| agent (function-call key) | `request_licence(creator_id, usage, days, render_cap)` · `submit_render(licence_id, sha256, face_check)` |
| anyone | `release_expired(licence_id)` |
| views | `verify(sha256)` · `get_creator` · `list_creators` · `get_brand` · `get_licence` · `get_receipt` · `licences_for_creator` · `licences_for_brand` · `unclaimed_of` |
| NEP-171/177/181 | `nft_token` · `nft_metadata` · `nft_total_supply` · `nft_tokens` · `nft_supply_for_owner` · `nft_tokens_for_owner` (limit ≤ 50); `nft_transfer`, `nft_transfer_call`, `nft_resolve_transfer` always panic: licence tokens are non-transferable |

`verify(sha256)` is Licensed when the creator approved that exact file and the licence is Active or Exhausted;
Expired or Revoked when approved but the licence ended or was revoked; Unknown otherwise. A licence's status (and its
token's) is computed on every read: Revoked; else Expired once `block_timestamp >= expires_at`; else Exhausted once
every render is used; else Active.

## Storage (measured in the unit tests)

The agent's key can't attach deposits, so storage for its calls is charged to the brand's escrow at 1e-5 NEAR/byte:

| What | Bytes | NEAR |
|---|---|---|
| Licence request (record + two index entries) | 403 | 0.00403 |
| Licence token mint (owner index + supply entry; reserved: 300) | 175 | 0.00175 |
| Ad receipt (+ its pending entry on the licence) | 140 | 0.0014 |

Licence + mint storage is reserved at `request_licence`, released on decline/cancel (the request is removed) and spent
on approval (the unused part of the mint reserve is released). Receipt storage is charged at `submit_render`.

## One account as creator and brand

Nothing forbids `brand == creator` (a self-licence, for demos): every method checks only that the caller holds the
role it needs, so the creator still approves the licence and each ad with their full-access key, while the agent's
function-call key can't call any approval. `one_account_can_license_itself_end_to_end` covers the whole path.

## Accounting notes

- **`spent` includes storage costs**, not only render payments, so the budget check
  (`spent + reserved + price <= total_budget`) is slightly conservative.
- **Declined or cancelled requests leave ~60 bytes of index entries** (≈ 0.0006 NEAR each). The licence record itself is
  removed and the brand's reservation released in full; those index bytes are paid by the contract account, and
  `licences_for_creator` / `licences_for_brand` skip the gaps.
- **Failed payouts go to `unclaimed`.** If the transfer to a creator fails, a callback credits it to
  `unclaimed[creator]` (see `unclaimed_of`); the creator calls `claim_unclaimed()`. Money never leaves the accounting.
- **The wasm build isn't reproducible.** It's built locally with `cargo near build non-reproducible-wasm` (no Docker),
  so the deployed binary can be checked against a local build of the same commit (sha256 below), not rebuilt
  bit-for-bit by a third party.

## Deployed (testnet)

- Account: `likeness-near-rohit.testnet`, deployed and initialised 12 Nov 2026 (tx
  `t4MegCBQbNoWCNMaa3ESGqp8mgE2BdVA5rhJi7ExDWe`).
- Code redeployed 13 Nov 2026 (code only, state kept; tx `Hip8z8PiidxZ8QFetZDhJ3jbNf7SsEBUi1Vcsa49YG4m`) to add
  `set_capture`. Code sha256: `0aac3cf0de146d7b833e8f0ce8b634dd866eaa6d4cc42ba87c5d62f977658b4d` (301,250 bytes), equal to
  `scripts/build.sh` output for the commit that added `set_capture`.
