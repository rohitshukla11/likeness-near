# Likeness

[![CI](https://github.com/rohitshukla11/likeness-near/actions/workflows/ci.yml/badge.svg)](https://github.com/rohitshukla11/likeness-near/actions/workflows/ci.yml)

Creators license their face to AI ads: a price per render, the uses they allow, a render cap and an expiry. They
approve every licence and every ad, are paid per render from the brand's escrow on NEAR, and can revoke at any time.
A brand's AI agent proposes the renders; every ad has a receipt anyone can verify as Licensed, Expired, Revoked or
Unknown.

**Live demo (NEAR testnet):** https://likenesss.onrender.com · Verify works without a wallet. Video is on for this demo,
capped at 3 clips a day site-wide.

**Tracks:** `nfts`, `security`, `business`, `open`, `privacy`, `agents`.

**Contract:** `likeness-near-rohit.testnet`
([explorer](https://testnet.nearblocks.io/address/likeness-near-rohit.testnet)).

## Proof it's live

Every hash below was checked on NEAR testnet on 14 Nov 2026.

| What | On-chain |
|---|---|
| Contract account | [`likeness-near-rohit.testnet`](https://testnet.nearblocks.io/address/likeness-near-rohit.testnet), current code hash `AggUALRhRf7kSK4c44J5ZXa74knNSrbeJtaJQxSGTnnJ` |
| The licence-NFT upgrade (code-only redeploy, state kept) | [`9bxx1Pf64VTXMRLSmMHv1mb4VtRa9U7BvRvm2xGxqWL5`](https://testnet.nearblocks.io/txns/9bxx1Pf64VTXMRLSmMHv1mb4VtRa9U7BvRvm2xGxqWL5) (DeployContract) |
| A paid `approve_render` (the creator approves an exact file; 0.04 NEAR paid from escrow) | [`87bdJZEp4gmLaW4KRYatgfsG4TTGAgEmkGmwhX5YRsrd`](https://testnet.nearblocks.io/txns/87bdJZEp4gmLaW4KRYatgfsG4TTGAgEmkGmwhX5YRsrd) |
| A `revoke_licence` (licence 0) | [`7VRgDYFxbbS3ihfXTnFKJYZWZCRKc7wVb1uiZUueQKJ7`](https://testnet.nearblocks.io/txns/7VRgDYFxbbS3ihfXTnFKJYZWZCRKc7wVb1uiZUueQKJ7) |
| Verify: a **Licensed** ad | [`43c05e2c…`](https://likenesss.onrender.com/verify?sha256=43c05e2cf8d2fff9c2b874484b67e1f4aa18c4aced2e43e1425d88848707b6d4) (licence 3) |
| Verify: a **Revoked** ad | [`cb3c7115…`](https://likenesss.onrender.com/verify?sha256=cb3c711510d2280036121a4df1de7bea7a4f7f2739877e568226c029e6b2ff9a) (licence 0) |
| An ad made with **TEE-verified** FLUX.2-klein and Qwen (attestation recorded, then approved and paid) | [`7158c9be…`](https://likenesss.onrender.com/verify?sha256=7158c9bef04e232bbe72678395d7b3de013ace2a03d6f61503f3b8e3872f070f) on [`/licence/5`](https://likenesss.onrender.com/licence/5): `submit_render` [`DixBQ81Q…`](https://testnet.nearblocks.io/txns/DixBQ81QrtUkzop1rXupBKV9nHo75RNrxJYt2wCyFjAU), `approve_render` [`FwD8eaMr…`](https://testnet.nearblocks.io/txns/FwD8eaMrwzwrnstXuDqC1zxWYBpFTxqsp6BisTdbsEoZ) |
| Licence NFT pages (the token's own on-chain SVG) | [`/licence/0`](https://likenesss.onrender.com/licence/0) (Revoked), [`/licence/1`](https://likenesss.onrender.com/licence/1), [`/licence/3`](https://likenesss.onrender.com/licence/3), [`/licence/5`](https://likenesss.onrender.com/licence/5) |

## NEAR features, with code pointers

| Feature | What it does | Code |
|---|---|---|
| Dynamic licence NFT (NEP-171 / 177 / 181) | Each approved licence is a non-transferable token owned by the brand. Its metadata is computed on every read: an on-chain SVG (status badge, renders, NEAR paid, expiry), the status (Active / Revoked / Expired / Exhausted, flipping with no write) and the money in `extra` / `licence_summary`. Revoked tokens stay as history. | `contract/src/nft.rs:84` (`licence_svg`), `:133` (`token_of`), `:189` (`nft_token`), `:195` (transfer refused), `:226` (metadata), `:244` (enumeration); `contract/src/types.rs:250` (`status_at`); `contract/src/views.rs:129` (`licence_summary`) |
| NFT events | `nft_mint` on approval; NEP-171 v1.2.0 `nft_metadata_update` on approve_licence, approve_render, revoke_licence, release_expired | `contract/src/events.rs:8`, `:14` |
| Function-call agent key + kill switch | The brand's agent signs with a function-call key on the brand's own account: receiver = the contract, methods `request_licence` and `submit_render` only, 0.25 NEAR gas allowance, no deposits, so it can't move funds. Deleting the key (one DeleteKey in the wallet) stops the agent. | `web/lib/near/methods.ts:60-62`; `web/components/brand/AgentKeyCard.tsx:69` |
| Escrow released only on the creator's approval of the exact file | `submit_render` reserves the price under an active licence (caps per licence, the brand's limits); only the creator's `approve_render(sha256)` pays, from that reservation. | `contract/src/render.rs:12` (`submit_render`), `:52` (`approve_render`), `:80` (payout); `contract/src/licence.rs:66` (`approve_licence`), `:105` (`revoke_licence`) |
| Public verify | `verify(sha256)` → Licensed / Expired / Revoked / Unknown, from the same status function as the token | `contract/src/views.rs:72` |
| NEP-413 sign-in | One-time 32-byte nonce, signature checked against the account's full-access keys, HttpOnly session | `web/lib/session.ts:65` |
| NEAR AI Cloud | FLUX.2-klein edits of the creator's reference photo (ads); Qwen for the brief screen, the ranking and the safety screen | `web/lib/ai/image.ts:17`, `web/lib/ai/nearai.ts:35`, `web/lib/ai/faceCheck.ts:20`, `web/lib/agent/rank.ts:81` |
| NEAR AI TEE attestation | Before each FLUX edit and each Qwen safety screen: a fresh nonce, NEAR AI's `/v1/attestation/report`, the Intel TDX quote verified to Intel's root CA, `report_data` binding the signing key and nonce, NVIDIA NRAS GPU evidence; recorded per ad, shown on review / Verify / `/trust` | `web/lib/tee/verify.ts:87` (`verifyTdxQuote`), `:135` (`reportDataBinds`), `:145` (`verifyNras`), `:191` (`verifyAttestation`), `:281` (10-min cache); `web/lib/tee/attestation.ts:29` (fetch + NRAS), `:74` (`attestForRender`); `web/lib/agent/pipeline.ts:55`, `:99` (the hooks); `web/app/api/tee/status/route.ts` (`/trust`) |

## Try it on the hosted demo (no install)

1. Open **/verify** and click the **Revoked** example → the contract answers **Revoked**: the ad was approved and paid
   on testnet, then its licence was revoked. Click **Licence token #0 →**.
2. **/licence/0** → the token's own image, drawn by the contract: a red **REVOKED** card, "1 used of 1",
   "Paid to creator: 0.04 NEAR", plus the money summary and the licence's transactions with explorer links.
   **/licence/1** → a green **ACTIVE** card.
3. **/creators** → the creators and their on-chain terms (price per render, uses, render cap, longest licence).
4. Drop any image on **/verify** → it's hashed in your browser (never uploaded) → **Unknown**: no licence covers it.
5. Sign in with a NEAR **testnet** wallet (e.g. Meteor) → you're a brand → **Dashboard** → brief the agent →
   **Find creators** → the banned-use screen, then the agent's top 3 with reasons and who wasn't eligible (demo mode:
   nothing is requested on-chain unless you're the brand that holds the server's agent key).

## Who is who

There is no creator sign-up. The one real creator is the project's author, **`rohitshukla.testnet`**, with his own
photo (published with his consent). Beside him are two **synthetic demo creators**, fictional people with AI-generated
faces, badged "Demo creator · synthetic face" on every card, shortlist entry and profile:

| Synthetic demo creator | Account | Niche | Terms |
|---|---|---|---|
| Asha | `likeness-synth-asha.testnet` | Lifestyle & food | 0.04 NEAR per render; Food & drink, Travel, Fashion, Beauty; up to 10 renders, 30 days |
| Maya Lindqvist | `likeness-synth-maya.testnet` | Fitness | 0.05 NEAR per render; Fitness, Fashion, Beauty; up to 8 renders, 21 days |

As a brand, the brief form starts with an example (a trail runner at sunrise for new trail shoes, Fitness, 14 days,
3 renders), ready to edit; **Find creators** screens it, filters and ranks the creators, and shows the agent's top 3.

Decisions for the synthetic creators (approving a licence or an ad) are made by the operator with their own testnet keys
(`pnpm -C web seed:synthetic approve-licence|approve-render …`), and labelled as such: there is no person to consent. Anyone else who signs in with a NEAR wallet is a **brand**: fund an escrow, set limits,
add the agent's key and brief the agent, which asks the creators for a licence.

The author's account is both a creator and a brand: it alone gets a **Creator | Brand** switch. A licence it grants
itself is labelled **"Self-licence (demo)"** in the app, the agent's
activity log, Verify and the standalone verifier, and its payment moves from the account's escrow back to itself.
The consent rules don't change: the creator still approves every licence and every ad from their own wallet, and the
agent's function-call key can only call `request_licence` and `submit_render`, never an approval.

- **Demo mode for other brands:** any signed-in brand other than the one holding the server's agent key runs "Find
  creators" in demo mode: the banned-use screen, then the agent's top 3 with reasons and the "Not eligible" list.
  Nothing is stored or requested on-chain; it's rate-limited per IP and counts toward the daily AI cap.
- **Verify a real receipt:** the Verify page links two examples: a **Revoked** one (an ad from our live run, approved
  and paid on testnet, then its licence was revoked) and, once one exists, a **Licensed** one
  (`NEXT_PUBLIC_DEMO_RECEIPT_LICENSED_SHA`).

## What runs where

- **Images:** every ad image is an edit of the creator's reference photo made on **NEAR AI Cloud** (FLUX.2-klein-4B).
  Qwen on NEAR AI Cloud then screens the ad alone for safety: a minor or sexualised content blocks it; other people in it
  regenerate it once, then drop it; if the screen gives no valid answer, it's asked once more, and still none drops the
  ad (fail closed). No AI identity check gates any payment or is shown as a verdict; the creator's approval is the only identity gate. The video start frame uses an internal face-match retry that only regenerates the frame. Only the creator can confirm it's them, by
  approving that exact file.
  Every receipt records `needs_creator_review`. The brief, the creator ranking and the banned-use screen also run
  there, on NEAR AI Cloud (`cloud-api.near.ai`). See "Privacy" below for exactly what is and isn't claimed.
- Video: start frame and clip made with Google's models from the creator's reference photo (outside NEAR AI); the creator approves every video. On by default for this demo; a per-creator opt-in is on the roadmap.
  Exactly as in the author's earlier likeness-paypal project: an image model makes a new 16:9 start frame (1K) of the
  person from their real reference photo (for the author, the 800x800 original; the registered on-chain reference is a
  crop of it; never from a FLUX ad), with rules that keep the face and drop the photo's clothes, accessories and pose. A
  face match (the same person, exactly one person) only asks for one more start frame, then drops the video; it is never
  shown as a verdict. The same safety screen as an ad then runs on it (on NEAR AI; fail closed). Only then **Google Gemini Omni Flash** turns it into a 4 s, 720p clip with the campaign's action, scene and
  product, keeping the first frame's person and face. The clip is stored as uploaded (sha256 over the stored bytes),
  submitted with `submit_render` (`needs_creator_review`), counts toward the licence's render cap, and is paid only when
  the creator approves it. It carries the label "AI-generated video · licensed likeness" over the player and in its
  record. Clips may include AI-generated ambient audio. Video is on by default for every creator (no opt-in). Caps: about $0.44 estimated per video (start frame +
  clip), refused over $0.50; 3 a day site-wide. `pnpm -C web video:dry <licenceId>` prints both prompts and the cost
  without calling anything. The key goes in `web/.env.local` under the variable named in `web/lib/video/config.ts`.
- **On-chain (NEAR testnet):** terms, licences (non-transferable tokens), escrow, receipts by sha256, payments.
- **Verify** hashes an image or video file in your browser (it's never uploaded) and asks the contract.

## Privacy

Face images are processed by two NEAR AI Cloud models, FLUX.2-klein (ad images) and Qwen (the agent and the safety
screen), and **this app verifies, before using each model, that it runs in a Trusted Execution Environment**. The check
is repeated with a fresh nonce at least every 10 minutes per model, recorded with every ad, and shown on the creator's
review page, in Verify, in each licence's history and on [`/trust`](https://likenesss.onrender.com/trust), where the latest raw report
can be downloaded.

What the app verifies (`web/lib/tee/verify.ts`, following NEAR AI's verifier):

- **A fresh 32-byte nonce**, generated by the app for each check, is echoed back by the model's attestation and by
  NEAR AI's gateway (no replayed report is accepted).
- **The Intel TDX quote is genuine**: its ECDSA signature by the quote's attestation key; the Quoting Enclave report
  signed by the PCK certificate and binding that key; the PCK certificate chain up to Intel's SGX Root CA, pinned by its
  SHA-256 fingerprint and valid at the time of the check.
- **The quote binds the model's signing key and our nonce**: `report_data` = the model's signing address (32 bytes)
  followed by the nonce.
- **The GPUs are genuine NVIDIA confidential-computing GPUs**: NVIDIA's attestation service (NRAS) verdict is true; every
  token NRAS returns is ES384-signed by a key in NVIDIA's published JWKS and not expired; the tokens carry our nonce; every
  GPU's measurements match, its nonce matches and debug mode is off.

An ad is labelled "Processed in a verified TEE" only when **every** check passed for both models; otherwise it says
"not verified" and names the failed check. A failed check never blocks or changes an ad, a payment or an approval: each
check has a 20-second limit, and `TEE_ATTESTATION_ENABLED=false` switches the checks (and every TEE label) off.

What is **not** verified, or not in a TEE:

- Intel's TCB status (whether the platform's firmware is up to date or revoked) is not checked.
- Chat-answer signatures (that a given answer was signed by the attested key) are not checked.
- Requests reach the models through NEAR AI's API gateway (its attestation is in the same report; the app checks that it
  echoes the nonce).
- The app server (Render) and the database (Neon) are not TEEs; reference photos and unapproved ads are stored there
  privately.
- Video is made with Google's models, outside any TEE.

| Where | Who can see the face | TEE |
|---|---|---|
| Browser | The signed-in creator (their photo and every ad of them) and the brand (its own ads); Verify only hashes files locally | No |
| App server (Render) | The server process handling a request (it forwards photos to the models and stores the results) | No |
| Database (Neon Postgres) | Stored privately: reference photos and ads not yet approved are served only to their creator and brand; an ad the contract verifies as Licensed becomes public | No |
| NEAR AI Cloud (FLUX.2-klein, Qwen) | The model inside NEAR AI's enclave; requests pass NEAR AI's API gateway | **Yes, verified by this app** before each use (fresh nonce, Intel TDX quote, key binding, NVIDIA GPUs) |
| Video provider (video only) | Google Gemini Omni Flash and the start-frame image model see the reference photo and the start frame | No |

Tests (`web/test/tee.test.ts`) run every check on a real report saved from NEAR AI, with NVIDIA's real answer: it
passes; a different nonce, one flipped byte in the quote, an expired or forged NVIDIA token each fail.

## The licence NFT

Every approved licence is a token (NEP-171 core, NEP-177 metadata, NEP-181 enumeration; `contract/src/nft.rs`):
`token_id` = the licence id, owned by the brand, non-transferable. See one at `/licence/<id>` in the app.

- **An on-chain dynamic image.** `nft_token(id).metadata.media` is an SVG (a data URI) the contract draws on every
  read from the stored licence (`licence_svg`, `contract/src/nft.rs:84`): a big status badge (ACTIVE green, REVOKED
  red, EXPIRED / EXHAUSTED grey), creator, brand, use, renders used of the cap, NEAR paid to the creator and the expiry
  date. Under 2 KB, plain shapes and text, no external files. `media_hash` is base64(sha256) of exactly that SVG
  (NEP-177). Nothing extra is stored: when the licence expires, the image says EXPIRED on the next read, with no
  transaction.
- **The money it holds and pays.** `extra` and the view `licence_summary(id)` (`contract/src/views.rs:129`) give the
  price, renders used / waiting / left, NEAR paid to the creator, the amount reserved now (ads waiting for the creator,
  held in the brand's escrow) and what goes back to the brand if the licence ends now. Payment happens only in the
  creator's `approve_render` (`contract/src/render.rs:52`), from that reservation.
- **Checked on every submission.** `submit_render` (`contract/src/render.rs:12`) refuses unless the caller is the
  token's owner (the brand), the licence is Active and unexpired, and a render is left under the cap;
  `approve_render` refuses once it's revoked or expired.
- **Revoked tokens are kept as history (a design choice).** Revoking never burns the token: it reads REVOKED from then
  on, so `verify(sha256)` can still prove an ad was approved under a licence that was later revoked (the Verify page's
  example). The cost: a wallet keeps showing it, marked Revoked.
- **Events.** `nft_mint` when the creator approves the licence, and NEP-171 (version 1.2.0) `nft_metadata_update` in
  `approve_licence`, `approve_render`, `revoke_licence` and `release_expired` (`contract/src/events.rs:14`), so
  wallets and indexers re-read the token. Expiry itself has no transaction; `release_expired` logs it when called.
- **Added in place.** These are views and logs only, deployed on 14 Nov 2026 as a code-only redeploy (no migration).
  The tests load the contract's real pre-upgrade testnet storage and read it with the new code
  (`contract/src/tests/onchain.rs`).
- **Roadmap (not built):** a NEAR sub-account per licence, so the licence is a real account that holds its own escrow.

## Known limitations

- **Testnet only.** The contract, payments and licence tokens are on NEAR testnet.
- **FLUX likeness drift** (details below): an ad may not look exactly like the creator, so the creator, not an AI,
  confirms each ad.
- **Video:** Video: start frame and clip made with Google's models from the creator's reference photo (outside NEAR AI); the creator approves every video. On by default for this demo; a per-creator opt-in is on the roadmap.
  Clips may include AI-generated ambient audio.
- **One agent key on the hosted demo:** only the brand that holds the server's agent key (the author's account) can
  run the full agent (licence requests and renders on-chain); every other signed-in brand gets demo mode.

## Roadmap

- The rest of attestation: Intel TCB status (collateral) and chat-answer signature checks.
- Payouts through NEAR Intents.
- Consent-gated transfer of a licence token (the creator approves the new holder).
- A NEAR sub-account per licence, holding its own escrow.
- A per-creator video opt-in.

## Known limitation: likeness on FLUX.2-klein

NEAR AI Cloud's image model, `black-forest-labs/FLUX.2-klein-4B` (its only image model), doesn't keep the creator's face
exactly. What we tested on 13 Nov 2026, with the author's own face, and what we saw:

- **Stage photo** (800×800, a microphone over the chin), as the full frame and as the 500×500 crop the app used: the
  live-run ad and two minimal-change edits ("keep the pose, framing and face; change only the background") kept the
  clothes, hair shape and pose but gave a rounder, different face, and added people in the background.
- **Background-only prompt** on the same full photo, run twice: both runs returned byte-identical images (the same
  input and prompt give the same output; in our 12 Nov spike the seed had no effect either). The face drifted, the pose
  changed and two people appeared, although the prompt said "No other people".
- **An unedited iPhone front-camera photo** (cropped; a wall socket covered in the background) with four templates:
  three made a new café scene with 3 to 5 extra people and a changed face; the one template that tells the model to
  leave the person untouched (only the background and a cup on a table change) kept the face, framing and expression,
  though a blurred figure still appeared behind and the safety screen counted only one face.

In short: the face is kept only when the edit leaves the person untouched; the output can't be varied by seed; extra
people appear even when the prompt forbids them.

Mitigations in the app: **the creator reviews and approves every image** (nothing is paid before that; no AI identity
check gates any payment or is shown as a verdict); **the safety screen** blocks minors and sexualised content, regenerates once and then drops an
ad with other people in it, and fails closed. An earlier AI identity check was removed after it rated an ad that wasn't
the author "likely the same person, 0.95".

Feedback for NEAR AI: an identity-preserving image-edit model (or reference-image conditioning) on NEAR AI Cloud would
remove this limitation. Not built here: an exact-likeness composite (the creator's own pixels over a generated
background), kept as a documented fallback.

## Layout

- `web/`: the Next.js app (pages and API routes), deployed on Render.
- `contract/`: the Rust NEAR contract (testnet: `likeness-near-rohit.testnet`).

## Run it

Needs Node 22 and pnpm 12 (`corepack enable`), and Rust (the version in `contract/rust-toolchain.toml`).

**Tests and build: no keys, no `.env.local`.**

```sh
git clone https://github.com/rohitshukla11/likeness-near && cd likeness-near
pnpm -C web install --frozen-lockfile
pnpm -C web test                 # 39 tests (agent rules, prompts, video pipeline and caps, safety rule, origins, ...)
pnpm -C web build
(cd contract && cargo test)      # 70 tests, incl. reading the real pre-upgrade testnet state with the new code
```

**The app locally:**

```sh
cp .env.example web/.env.local   # fill in what you need (below)
pnpm -C web db:migrate           # once, if DATABASE_URL is set
pnpm -C web dev                  # http://localhost:3000
```

What each feature needs:

| Feature | Needs |
|---|---|
| Verify, /creators, /licence/&lt;id&gt; (read straight from the contract) | `NEXT_PUBLIC_CONTRACT_ID`, `NEXT_PUBLIC_NEAR_NETWORK=testnet` (a public RPC is the fallback) |
| Sign-in, dashboards, the agent's activity log, licence history | `DATABASE_URL` (Postgres), `SESSION_SECRET` |
| Find creators (banned-use screen, ranking), ad images, the safety screen | `NEARAI_API_KEY` (NEAR AI Cloud). `AI_MODE=test` makes no model call and uses the labelled rule-based path |
| Licence requests and ad submissions on-chain | `AGENT_ACCOUNT_ID` + `AGENT_PRIVATE_KEY`: the brand's function-call key (`request_licence`, `submit_render` only) |

`pnpm -C web secrets:init <brand>.testnet` writes `SESSION_SECRET` and a new agent key into `web/.env.local` (never to
the screen) and prints only the agent's public key, which the brand adds from the dashboard (one AddKey in the wallet).
| Video (optional) | `VIDEO_ENABLED=true` and the video key named in `web/lib/video/config.ts` |
| Deploying the contract | near-cli-rs and a testnet account key in `~/.near-credentials` (`contract/README.md`) |

Keys live only in `web/.env.local` and `~/.near-credentials`, both outside git. Or skip all of it and use the hosted
demo: https://likenesss.onrender.com

## Image sources

- **The real creator's photo:** supplied by Rohit Shukla for this demo and published with his consent.
  `web/public/creators/rohit.jpg` (sha256 `89a4d997…`) is his registered on-chain reference: every ad of him is an edit
  of it. It is a crop of the 800x800 original `web/public/creators/rohit-card.jpg` (sha256 `0f03b10c…`), which the
  creator cards show and which is the video start frame's reference.
- **Synthetic demo creators** (fictional people, AI-generated faces): `web/public/synthetic/PROVENANCE.md`.
- **Landing-page faces** (AI-generated by the author, no real person): `web/public/landing/PROVENANCE.md`.

## Third-party libraries

- **Web app** (`web/package.json`): `next` 16.3.8, `react` / `react-dom` 19.2.8, `@hot-labs/near-connect` 0.12.0,
  `near-api-js` 7.4.0, `@neondatabase/serverless` 1.2.0; dev: `typescript` 5.9.3, `tailwindcss` / `@tailwindcss/postcss`
  4.3.3, `eslint` 9.39.5, `eslint-config-next` 16.3.8, `@types/node` 22.20.5, `@types/react` 19.3.0,
  `@types/react-dom` 19.3.0.
- **Contract** (`contract/Cargo.toml`): `near-sdk` 5.30.1, `near-contract-standards` 5.30.1.
- **Services:** NEAR testnet RPC (FastNEAR), NEAR AI Cloud, Neon Postgres, Render; video only: Google Gemini Omni Flash.

Licence: MIT.
