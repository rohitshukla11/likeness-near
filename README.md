# Likeness

[![CI](https://github.com/rohitshukla11/likeness-near/actions/workflows/ci.yml/badge.svg)](https://github.com/rohitshukla11/likeness-near/actions/workflows/ci.yml) · Evidence (real output, commit + date in each): [contract tests 70/70](docs/evidence/contract-tests.txt) · [web tests 51/51](docs/evidence/web-tests.txt) · [deployed code hash MATCH](docs/evidence/verify-deployed.txt)

A brand's AI agent licenses a real creator's face for ads; the creator approves every licence and every ad and is paid
per approved ad from the brand's escrow on NEAR. Anyone can verify an ad: Licensed, Expired, Revoked or Unknown.

**Live demo (NEAR testnet):** https://likenesss.onrender.com · **Tracks:** `nfts`, `security`, `business`, `open`,
`privacy`, `agents` ([how it meets each](#how-likeness-meets-each-track))

## For judges

**(a) No wallet, no install:**

| Open | You see |
|---|---|
| [Verify: Licensed example](https://likenesss.onrender.com/verify?sha256=7158c9bef04e232bbe72678395d7b3de013ace2a03d6f61503f3b8e3872f070f) | **Licensed**, Licence NFT #5, **🔒 AI processing: verified TEE (NEAR AI)** |
| [Verify: Revoked example](https://likenesss.onrender.com/verify?sha256=cb3c711510d2280036121a4df1de7bea7a4f7f2739877e568226c029e6b2ff9a) | **Revoked**: approved and paid, then revoked by the creator |
| [`/licence/5`](https://likenesss.onrender.com/licence/5), [`/licence/0`](https://likenesss.onrender.com/licence/0) | The licence NFT drawn by the contract (ACTIVE / REVOKED), its money and transactions |
| [`/trust`](https://likenesss.onrender.com/trust) | NEAR AI's TEE attestation for both models, verified live; raw report download |
| [`/creators`](https://likenesss.onrender.com/creators) | The creators and their on-chain terms |

**(b) Tests, no keys, no `.env`** (the install needs the network; the tests run offline). Same as
[CI](https://github.com/rohitshukla11/likeness-near/actions/workflows/ci.yml):

```sh
pnpm -C web install --frozen-lockfile
pnpm -C web test                 # 51 tests (TEE checks on a saved real report)
(cd contract && cargo test)      # 70 tests
```

`pnpm -C web build` needs no keys but downloads web fonts (network).

**(c) Full app locally:** needs a Neon database, a NEAR AI key and a testnet agent key: [Run it locally](#run-it-locally).

**(d) With a NEAR testnet wallet** (e.g. Meteor): sign in → you're a brand → **Find creators** → the agent's shortlist
with reasons (demo mode, nothing on-chain). The full licence → ad → payment flow runs only for the brand holding the
server's agent key: see the demo video and [Proof it's live](#proof-its-live).

## Screenshots

| | |
|---|---|
| ![Creator dashboard and generated ads](docs/screenshots/creator-dashboard-ads.webp) The creator's dashboard: earnings and counts (public on NEAR), the ad waiting for approval, and the ads (images and videos) made with their face, each with its licence | ![Creator review with TEE panels](docs/screenshots/creator-review-tee.webp) The creator's review page: both models **🔒 verified in a TEE**; nothing is paid until the creator approves |
| ![Licence NFT 5](docs/screenshots/licence-5-active.webp) The licence NFT drawn on-chain from live state: **ACTIVE**, 0.08 NEAR paid, 🔒 TEE verified ad | ![Trust](docs/screenshots/trust-tee-attestation.webp) `/trust`: FLUX.2-klein and Qwen **TEE verified** |
| ![Set up once](docs/screenshots/brand-setup-once.webp) Escrow, limits, and an agent key that **can't move NEAR** | ![Shortlist](docs/screenshots/brand-shortlist.webp) The agent's shortlist with reasons, and who isn't eligible |
| ![Landing](docs/screenshots/landing.webp) The hosted app | ![Agent activity](docs/screenshots/agent-activity.webp) The agent's activity log: its shortlist with reasons, who it skipped and why, and each ad it made and submitted, with Verify and transaction links |

## Problem

- **Brands:** creator content doesn't scale; shoots are slow and costly; AI ads without the person's consent are a legal
  and reputational risk.
- **Creators:** income is capped by their time; paid likeness licensing reaches only the top 1%.

## What Likeness does

- **On-chain terms:** price per render, allowed uses, render cap, longest licence.
- **An agent that can't move funds:** a function-call key limited to `request_licence` and `submit_render`.
- **Approval of every ad:** the creator approves the licence, then each ad by its sha256, in their own wallet.
- **Escrow pays only on approval** of that exact file.
- **Licence NFTs:** non-transferable NEP-171 tokens whose image the contract draws from live state.
- **Verify:** hash a file in the browser, ask the contract.

## How to test (hosted site)

1. **Verify → Licensed example** → Licensed, NFT #5, "🔒 AI processing: verified TEE (NEAR AI)".
2. **Licence token #5 →** → green **ACTIVE** card, "Paid to creator: 0.08 NEAR", history with **🔒 TEE verified**.
3. **Verify → Revoked example** → Revoked → **Licence token #0 →** → red **REVOKED** card.
4. **Trust** → both models **TEE verified**, each check listed.
5. **Creators** → creators and their on-chain terms.
6. Drop any image on **Verify** → hashed in the browser, never uploaded → **Unknown**.
7. With a testnet wallet: **Connect NEAR wallet** → sign a message (NEP-413, no transaction) → **Dashboard** → the
   brief is prefilled (a trail runner, Fitness) → **Find creators** → shortlist with reasons and a "Not eligible" list.

Creators: the author, `rohitshukla.testnet`, is the one real creator (his photo, published with his consent); Asha and
Maya Lindqvist are synthetic (AI-generated faces, badged everywhere). The author's account is also a brand; a licence it
grants itself is labelled **Self-licence (demo)** and still needs his approval in his own wallet.

## Proof it's live

Every hash below was checked on NEAR testnet (14–15 Nov 2026).

| What | On-chain |
|---|---|
| Contract | [`likeness-near-rohit.testnet`](https://testnet.nearblocks.io/address/likeness-near-rohit.testnet), code hash `AggUALRhRf7kSK4c44J5ZXa74knNSrbeJtaJQxSGTnnJ` |
| Deployed code = this source | `contract/scripts/verify-deployed.sh` builds the wasm with `scripts/build.sh`, computes NEAR's code hash (base58 of its sha256), reads `code_hash` from public testnet RPC (`view_account`) and exits 0 only on a match. Run on 15 Nov 2026: `local build hash: AggUALRhRf7k…`, `deployed code_hash: AggUALRhRf7k…`, `MATCH`. Output: [`docs/evidence/verify-deployed.txt`](docs/evidence/verify-deployed.txt). Same toolchain (`rust-toolchain.toml`) and cargo home path needed: the wasm embeds the cargo registry's paths, so it isn't a CI step. |
| Licence-NFT upgrade (code-only, state kept) | [`9bxx1Pf6…`](https://testnet.nearblocks.io/txns/9bxx1Pf64VTXMRLSmMHv1mb4VtRa9U7BvRvm2xGxqWL5) |
| A TEE-verified ad, approved and paid | [`7158c9be…`](https://likenesss.onrender.com/verify?sha256=7158c9bef04e232bbe72678395d7b3de013ace2a03d6f61503f3b8e3872f070f) on [`/licence/5`](https://likenesss.onrender.com/licence/5): `submit_render` [`DixBQ81Q…`](https://testnet.nearblocks.io/txns/DixBQ81QrtUkzop1rXupBKV9nHo75RNrxJYt2wCyFjAU), `approve_render` [`FwD8eaMr…`](https://testnet.nearblocks.io/txns/FwD8eaMrwzwrnstXuDqC1zxWYBpFTxqsp6BisTdbsEoZ) |
| A paid `approve_render` (0.04 NEAR) | [`87bdJZEp…`](https://testnet.nearblocks.io/txns/87bdJZEp4gmLaW4KRYatgfsG4TTGAgEmkGmwhX5YRsrd) |
| A `revoke_licence` (licence 0) | [`7VRgDYFx…`](https://testnet.nearblocks.io/txns/7VRgDYFxbbS3ihfXTnFKJYZWZCRKc7wVb1uiZUueQKJ7) |
| Verify | Licensed: [`7158c9be…`](https://likenesss.onrender.com/verify?sha256=7158c9bef04e232bbe72678395d7b3de013ace2a03d6f61503f3b8e3872f070f), [`43c05e2c…`](https://likenesss.onrender.com/verify?sha256=43c05e2cf8d2fff9c2b874484b67e1f4aa18c4aced2e43e1425d88848707b6d4); Revoked: [`cb3c7115…`](https://likenesss.onrender.com/verify?sha256=cb3c711510d2280036121a4df1de7bea7a4f7f2739877e568226c029e6b2ff9a) |

## NEAR features used

| Feature | What it does | Code |
|---|---|---|
| Dynamic licence NFT (NEP-171 / 177 / 181) | Non-transferable, owned by the brand; metadata computed on every read: on-chain SVG, status (flips with no write), money | `contract/src/nft.rs:84` (`licence_svg`), `:133` (`token_of`), `:189` (`nft_token`), `:195` (transfer refused), `:226` (metadata), `:244` (enumeration); `contract/src/types.rs:250` (`status_at`); `contract/src/views.rs:129` (`licence_summary`) |
| NFT events | `nft_mint`; NEP-171 v1.2.0 `nft_metadata_update` on approve_licence, approve_render, revoke_licence, release_expired | `contract/src/events.rs:8`, `:14` |
| Function-call agent key + kill switch | Receiver = the contract; `request_licence` and `submit_render` only; 0.25 NEAR gas allowance; no deposits, so it can't move funds; one DeleteKey stops it | `web/lib/near/methods.ts:60-62`; `web/components/brand/AgentKeyCard.tsx:69` |
| Escrow released only on approval of the exact file | `submit_render` reserves the price (per-licence caps, brand limits); only the creator's `approve_render(sha256)` pays | `contract/src/render.rs:12` (`submit_render`), `:52` (`approve_render`), `:80` (payout); `contract/src/licence.rs:66` (`approve_licence`), `:105` (`revoke_licence`) |
| Public verify | `verify(sha256)` → Licensed / Expired / Revoked / Unknown, same status function as the token | `contract/src/views.rs:72` |
| NEP-413 sign-in | One-time 32-byte nonce, checked against the account's full-access keys | `web/lib/session.ts:65` |
| NEAR AI Cloud | FLUX.2-klein edits of the creator's photo; Qwen for the brief screen, ranking and safety screen | `web/lib/ai/image.ts:17`, `web/lib/ai/nearai.ts:35`, `web/lib/ai/faceCheck.ts:20`, `web/lib/agent/rank.ts:81` |
| NEAR AI TEE attestation | Before each FLUX edit and Qwen safety screen: fresh nonce, `/v1/attestation/report`, Intel TDX quote to Intel's root CA, `report_data` binding, NVIDIA NRAS; recorded per ad | Nonce: `web/lib/tee/attestation.ts:30`, `web/lib/tee/verify.ts:209`<br>TDX quote + Intel chain: `web/lib/tee/verify.ts:87`, `:217`<br>Key binding: `web/lib/tee/verify.ts:135`, `:218`<br>NVIDIA GPUs: `web/lib/tee/attestation.ts:45`, `web/lib/tee/verify.ts:145`, `:226`<br>All checks: `web/lib/tee/verify.ts:191`; hooks: `web/lib/agent/pipeline.ts:55`, `:99`; `/trust`: `web/app/api/tee/status/route.ts` |

## How Likeness meets each track

The demo is a self-licence: the author is both creator and brand. On-chain, the agent's **function-call key** signed
`request_licence` [`52fKFkkQ…`](https://testnet.nearblocks.io/txns/52fKFkkQpJMoGUhquUs4FLW4UbaG2EKSvAutSk64rbDP) and `submit_render` [`DixBQ81Q…`](https://testnet.nearblocks.io/txns/DixBQ81QrtUkzop1rXupBKV9nHo75RNrxJYt2wCyFjAU); the creator's **full-access wallet key** signed `approve_render` [`FwD8eaMr…`](https://testnet.nearblocks.io/txns/FwD8eaMrwzwrnstXuDqC1zxWYBpFTxqsp6BisTdbsEoZ).

### Open Innovation

| | |
|---|---|
| **NEAR tech** | Escrow + licence NFT contract (`contract/src/render.rs:12`), agent function-call key (`web/lib/near/methods.ts:60-62`), NEP-413 sign-in (`web/lib/session.ts:56`), NEAR AI Cloud (`web/lib/ai/nearai.ts:35`) |
| **Real, not simulated** | Live on testnet: [Verify `7158c9be…`](https://likenesss.onrender.com/verify?sha256=7158c9bef04e232bbe72678395d7b3de013ace2a03d6f61503f3b8e3872f070f) is Licensed, [Verify `cb3c7115…`](https://likenesss.onrender.com/verify?sha256=cb3c711510d2280036121a4df1de7bea7a4f7f2739877e568226c029e6b2ff9a) is Revoked; paid `approve_render` [`87bdJZEp…`](https://testnet.nearblocks.io/txns/87bdJZEp4gmLaW4KRYatgfsG4TTGAgEmkGmwhX5YRsrd) |
| **Track fit** | A consent and payment rail for AI ads that use a real person's face; anyone can check an ad by its hash |
| **Execution** | Hosted app; 51 web + 70 contract tests, [CI](https://github.com/rohitshukla11/likeness-near/actions/workflows/ci.yml); `contract/scripts/verify-deployed.sh` matches the deployed code hash |
| **Not built** | Mainnet; payouts through NEAR Intents |

### NFTs That Do Something

| | |
|---|---|
| **NEAR tech** | NEP-171/177/181 token, metadata computed on read, SVG drawn on-chain (`contract/src/nft.rs:84`, `:189`); `nft_metadata_update` events (`contract/src/events.rs:14`) |
| **Real, not simulated** | [`/licence/5`](https://likenesss.onrender.com/licence/5) ACTIVE, [`/licence/0`](https://likenesss.onrender.com/licence/0) REVOKED, redrawn from live state; NFT upgrade [`9bxx1Pf6…`](https://testnet.nearblocks.io/txns/9bxx1Pf64VTXMRLSmMHv1mb4VtRa9U7BvRvm2xGxqWL5) (code only, state kept) |
| **Track fit** | The token *is* the licence: status flips on expiry with no write (`contract/src/types.rs:250`), money in `licence_summary` (`contract/src/views.rs:129`), `verify(sha256)` (`contract/src/views.rs:72`); transfer refused (`contract/src/nft.rs:195`) |
| **Execution** | Storage sizes pinned in `contract/src/tests/nft.rs`; the real pre-upgrade state read by the new code in `contract/src/tests/onchain.rs` |
| **Not built** | Consent-gated transfer (non-transferable by design); no marketplace |

### AI Security & Defense

| | |
|---|---|
| **NEAR tech** | Function-call key: 2 methods, no deposits, 0.25 NEAR allowance (`web/lib/near/methods.ts:60-62`); DeleteKey kill switch (`web/components/brand/AgentKeyCard.tsx:69`); single-use NEP-413 nonce (`web/lib/session.ts:56`) |
| **Real, not simulated** | Agent txs [`52fKFkkQ…`](https://testnet.nearblocks.io/txns/52fKFkkQpJMoGUhquUs4FLW4UbaG2EKSvAutSk64rbDP), [`DixBQ81Q…`](https://testnet.nearblocks.io/txns/DixBQ81QrtUkzop1rXupBKV9nHo75RNrxJYt2wCyFjAU) signed by the function-call key; payment [`FwD8eaMr…`](https://testnet.nearblocks.io/txns/FwD8eaMrwzwrnstXuDqC1zxWYBpFTxqsp6BisTdbsEoZ) only by the creator's own key |
| **Track fit** | The agent can't pay anyone: only the creator's `approve_render` pays (`contract/src/render.rs:57`); safety screen fails closed (`web/lib/ai/faceRule.ts:52`, `:69`); video face check fails closed (`web/lib/video/startframe.ts:50`); AI spend cap (`web/lib/costcap.ts:38`) |
| **Execution** | `web/test/faceRule.test.ts`, `web/test/video.test.ts` (check error → no video model call); caps in `contract/src/tests/render.rs` |
| **Not built** | Intel TCB status and chat-answer signatures in the TEE check |

### Autonomous Business

| | |
|---|---|
| **NEAR tech** | Brand escrow and limits (`contract/src/brand.rs:12`, `:30`); price reserved per ad (`contract/src/render.rs:20-26`), paid on approval (`:81`); failed payouts claimable (`:120`) |
| **Real, not simulated** | Paid `approve_render` [`87bdJZEp…`](https://testnet.nearblocks.io/txns/87bdJZEp4gmLaW4KRYatgfsG4TTGAgEmkGmwhX5YRsrd); licence 5 paid per approved ad ([`/licence/5`](https://likenesss.onrender.com/licence/5)) |
| **Track fit** | The agent finds (`web/lib/agent/brandAgent.ts:32`), ranks (`web/lib/agent/rank.ts:81`), requests (`web/lib/agent/brandAgent.ts:81`), makes (`web/lib/agent/pipeline.ts:41`) and submits ads; people only approve |
| **Execution** | Every step logged with its reason (`web/lib/db/records.ts:115`, shown by `web/components/brand/BrandAgentConsole.tsx:135`); video caps $0.50 each, 3 a day (`web/lib/video/caps.ts:19`) |
| **Not built** | Payouts through NEAR Intents; a NEAR sub-account per licence holding its escrow |

### Privacy & Private AI

| | |
|---|---|
| **NEAR tech** | NEAR AI Cloud in TEEs, attestation verified before each FLUX edit and safety screen (`web/lib/tee/verify.ts:191`; `web/lib/agent/pipeline.ts:55`, `:99`) |
| **Real, not simulated** | [`/trust`](https://likenesss.onrender.com/trust): both models TEE-verified live; [Verify `7158c9be…`](https://likenesss.onrender.com/verify?sha256=7158c9bef04e232bbe72678395d7b3de013ace2a03d6f61503f3b8e3872f070f) shows the TEE-verified edit; raw report via `/api/tee/status?model=…&raw=1` |
| **Track fit** | Photos stay private until an ad is Licensed: 401 / 404 for anyone else (`web/app/api/media/[sha256]/route.ts:33-34`); ranking sees text only, no images (`web/lib/agent/rank.ts:47`) |
| **Execution** | `web/test/tee.test.ts` checks a saved real report offline |
| **Not built** | Intel TCB status, chat-answer signatures; video (Google Gemini Omni Flash and its start-frame model) runs outside any TEE |

### Agent Economy

| | |
|---|---|
| **NEAR tech** | The agent acts for the brand's account with a function-call key; the contract holds the market rules (`contract/src/licence.rs:12`, `contract/src/render.rs:12`); creators' terms on-chain (`contract/src/creator.rs:13`) |
| **Real, not simulated** | Agent `request_licence` [`52fKFkkQ…`](https://testnet.nearblocks.io/txns/52fKFkkQpJMoGUhquUs4FLW4UbaG2EKSvAutSk64rbDP) and `submit_render` [`DixBQ81Q…`](https://testnet.nearblocks.io/txns/DixBQ81QrtUkzop1rXupBKV9nHo75RNrxJYt2wCyFjAU); creator `approve_render` [`FwD8eaMr…`](https://testnet.nearblocks.io/txns/FwD8eaMrwzwrnstXuDqC1zxWYBpFTxqsp6BisTdbsEoZ) |
| **Track fit** | An agent buys a human's likeness per approved deliverable; on-chain terms filter who it may ask (`web/lib/agent/shortlist.ts:51`) |
| **Execution** | One agent key on the hosted demo; other signed-in brands get demo mode (`web/lib/agent/mode.ts:12`) |
| **Not built** | NEAR's Agent API; agent-to-agent negotiation; per-brand agent keys on the hosted demo |

## Why a function-call key, not the Agent API

- **NEAR-native, enforced by the protocol:** the key may call only `request_licence` and `submit_render` on this
  contract, can't attach deposits, and has a 0.25 NEAR gas allowance (`web/lib/near/methods.ts:60-62`); one DeleteKey
  stops it (`web/components/brand/AgentKeyCard.tsx:69`).
- **What a generic policy can't do, the contract does:**
  - Payment only when the **creator** approves the exact sha256 (`contract/src/render.rs:57`, paid at `:81`).
  - Per-licence caps (`contract/src/render.rs:20`) and the brand's limits (`:25-26`).
  - Refunds: reject (`contract/src/render.rs:103`); revoke or expiry (`contract/src/licence.rs:109` → `:128`).

## The licence NFT

- **Drawn on-chain.** `nft_token(id).metadata.media` is an SVG the contract draws on every read
  (`contract/src/nft.rs:84`): status badge (ACTIVE green, REVOKED red, EXPIRED / EXHAUSTED grey), creator, brand, use,
  renders used, NEAR paid, expiry. Under 2 KB; `media_hash` = base64(sha256) of that SVG.
- **Status computed on read:** an expired licence reads EXPIRED with no transaction.
- **Non-transferable by design:** it is consent from one creator to one brand.
- **Money:** `extra` and `licence_summary(id)`: price, renders used / waiting / left, paid to the creator, reserved now,
  and what goes back to the brand if it ends now.
- **Events:** `nft_mint`, and `nft_metadata_update` whenever the image changes.
- **Revoked tokens kept as history:** never burned, so `verify(sha256)` still proves an ad was approved under a licence
  later revoked.
- **Added in place:** a code-only redeploy; tests read the real pre-upgrade testnet storage with the new code
  (`contract/src/tests/onchain.rs`).

## Privacy & TEE attestation

Face images are processed by two NEAR AI Cloud models, FLUX.2-klein (ad images) and Qwen (the agent and the safety
screen), and **this app verifies, before using each model, that it runs in a Trusted Execution Environment**: with a
fresh nonce at least every 10 minutes per model, recorded with every ad, shown on the review page, in Verify, in licence
history and on [`/trust`](https://likenesss.onrender.com/trust) (raw report downloadable).

| Check | What it proves | Code |
|---|---|---|
| Fresh nonce | A new 32-byte nonce is echoed back by the model's attestation and NEAR AI's gateway (no replayed report). | `web/lib/tee/attestation.ts:30` (nonce), `:36` (report request); `web/lib/tee/verify.ts:209` (echo check) |
| Intel TDX quote + Intel chain | Signed by its attestation key; the Quoting Enclave report signed by the PCK certificate and binding that key; the PCK chain up to Intel's SGX Root CA, pinned by fingerprint, valid now. | `web/lib/tee/verify.ts:87` (`verifyTdxQuote`), `:120` (quote sig), `:126` (QE report sig), `:127` (QE binds key), `:128` (chain), `:129` (root pinned, `:21`), `:130` (valid now), `:217` |
| Key binding | `report_data` = the model's signing address (32 bytes) + the nonce. | `web/lib/tee/verify.ts:135` (`reportDataBinds`), `:218` |
| NVIDIA GPUs | NRAS verdict true; every token ES384-signed by NVIDIA's published keys, not expired, with our nonce; every GPU's measurements and nonce match, debug off. | `web/lib/tee/attestation.ts:45` (NRAS), `:19` (JWKS); `web/lib/tee/verify.ts:145` (`verifyNras`), `:166` (ES384), `:175` (nonce), `:179` (per GPU), `:226` |
| Before each use | Run before every FLUX edit and Qwen safety screen; the result is stored with the ad. | `web/lib/agent/pipeline.ts:55` (FLUX), `:99` (Qwen); `web/lib/tee/attestation.ts:74` (`attestForRender`) |

"Processed in a verified TEE" appears only when **every** check passed for both models; otherwise "not verified" names
the failed check. A failed check never blocks an ad, a payment or an approval (20-second limit;
`TEE_ATTESTATION_ENABLED=false` turns checks and labels off). `web/test/tee.test.ts` runs every check on a real saved
report: it passes; a different nonce, one flipped quote byte, an expired or forged NVIDIA token each fail.

**Not verified, or not in a TEE:**

- Intel's TCB status (whether the platform's firmware is up to date or revoked) is not checked.
- Chat-answer signatures (that a given answer was signed by the attested key) are not checked.
- Requests reach the models through NEAR AI's API gateway (its attestation is in the same report; the app checks that it
  echoes the nonce).
- The app server (Render) and the database (Neon) are not TEEs; reference photos and unapproved ads are stored there
  privately.
- Video is made with Google's models, outside any TEE.

| Where | Who can see the face | TEE |
|---|---|---|
| Browser | The signed-in creator and brand; Verify only hashes files locally | No |
| App server (Render) | The server process (forwards photos to the models, stores results) | No |
| Database (Neon) | Stored privately: reference photos and unapproved ads go only to their creator and brand; a Licensed ad becomes public | No |
| NEAR AI Cloud (FLUX.2-klein, Qwen) | The model inside NEAR AI's enclave, via NEAR AI's gateway | **Yes, verified by this app** before each use |
| Video provider (video only) | Google Gemini Omni Flash and the start-frame image model | No |

Safety and identity: Qwen screens each ad: a minor or sexualised content blocks it; other people → one regeneration,
then dropped; no valid answer → asked once more, then dropped (fail closed). No AI identity check gates any payment or is shown as a verdict; the creator's approval is the only identity gate. The video start frame gets an internal face match first (never shown as a verdict), failing closed: no match, or a
check that can't run or gives no valid answer → one new frame; still not → the job is dropped before the video model
is called (nothing submitted, only the start frames paid for).

## Known limitations

- **Testnet only.**
- **FLUX likeness drift.** NEAR AI Cloud's only image model, `black-forest-labs/FLUX.2-klein-4B`, doesn't keep the face
  exactly. Tested on 13 Nov 2026 with the author's face: scene-changing edits gave a different face and added people
  even when the prompt forbids them; the same input and prompt return byte-identical images (the seed had no effect);
  the face was kept only when the person was left untouched. So the creator, not an AI, confirms every ad.
- **Video:** Video: start frame and clip made with Google's models from the creator's reference photo (outside NEAR AI); the creator approves every video. On by default for this demo; a per-creator opt-in is on the roadmap.
  Clips may include AI-generated ambient audio. 4 s, 720p, labelled "AI-generated video · licensed likeness"; about
  $0.44 each, refused over $0.50, 3 a day site-wide.
- **One agent key on the hosted demo:** only the brand holding the server's agent key (the author's) runs the full
  agent; other signed-in brands get demo mode.

## Roadmap

- The rest of attestation: Intel TCB status and chat-answer signatures.
- Payouts through NEAR Intents.
- Consent-gated transfer of a licence token.
- A NEAR sub-account per licence, holding its own escrow.
- A per-creator video opt-in.

## Run it locally

Node 22, pnpm 12 (`corepack enable`), Rust (`contract/rust-toolchain.toml`). `web/`: the Next.js app; `contract/`: the
Rust contract (build, test, deploy: `contract/README.md`).

```sh
git clone https://github.com/rohitshukla11/likeness-near && cd likeness-near
pnpm -C web install --frozen-lockfile
cp .env.example web/.env.local   # fill in what you need (below)
pnpm -C web db:migrate           # once, if DATABASE_URL is set
pnpm -C web dev                  # http://localhost:3000
```

What each feature needs:

| Feature | Needs |
|---|---|
| Verify, /creators, /licence/&lt;id&gt; | `NEXT_PUBLIC_CONTRACT_ID`, `NEXT_PUBLIC_NEAR_NETWORK=testnet` |
| Sign-in, dashboards, activity log, licence history | `DATABASE_URL` (Postgres), `SESSION_SECRET` |
| Find creators, ad images, safety screen, TEE attestation | `NEARAI_API_KEY` (`AI_MODE=test`: no model call, labelled rule-based path) |
| Licence requests and ad submissions on-chain | `AGENT_ACCOUNT_ID` + `AGENT_PRIVATE_KEY` (the brand's function-call key) |
| Video (optional) | `VIDEO_ENABLED=true` and the video API key (`.env.example`) |
| Deploying the contract | near-cli-rs and a testnet key in `~/.near-credentials` |

`pnpm -C web secrets:init <brand>.testnet` writes `SESSION_SECRET` and a new agent key into `web/.env.local` and prints
only the public key (the brand adds it with one AddKey). Keys stay in `web/.env.local` and `~/.near-credentials`,
outside git.

## Third-party libraries

Web (`web/package.json`): `next` 16.3.8, `react` / `react-dom` 19.2.8, `@hot-labs/near-connect` 0.12.0, `near-api-js`
7.4.0, `@neondatabase/serverless` 1.2.0; dev: `typescript` 5.9.3, `tailwindcss` / `@tailwindcss/postcss` 4.3.3, `eslint`
9.39.5, `eslint-config-next` 16.3.8, `@types/*`. Contract (`contract/Cargo.toml`): `near-sdk` 5.30.1,
`near-contract-standards` 5.30.1. Services: FastNEAR RPC, NEAR AI Cloud, Neon, Render;
video only: Google Gemini Omni Flash.

**Image sources:** the real creator's photo was supplied by Rohit Shukla and is published with his consent;
`web/public/creators/rohit.jpg` (sha256 `89a4d997…`) is his on-chain reference, a crop of the 800x800 original
`web/public/creators/rohit-card.jpg` (sha256 `0f03b10c…`, shown on creator cards; the video reference). Synthetic
creators: `web/public/synthetic/PROVENANCE.md`. Landing faces (AI-generated, no real person):
`web/public/landing/PROVENANCE.md`.

## License

MIT.
