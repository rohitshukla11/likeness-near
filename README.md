# Likeness on NEAR

Creators license their face to AI ads: a price per render, the uses they allow, a render cap and an expiry. They
approve every licence and every ad, are paid per render from the brand's escrow on NEAR, and can revoke at any time.
A brand's AI agent proposes the renders; every ad has a receipt anyone can verify as Licensed, Expired, Revoked or
Unknown.

Built for NEAR HACKATHON 2026, from FaceVisa (GitHub: rohitshukla11/eth_mumbai @ b1976e4).

> Work in progress. The full README (try it, run it, what's on-chain) lands with the docs commit.

## Who is who

There is no creator sign-up. The one real creator is the project's author, **`rohitshukla.testnet`**, with his own
photo (published with his consent). Beside him are two **synthetic demo creators**, fictional people with AI-generated
faces, badged "Demo creator · synthetic face" on every card, shortlist entry and profile:

| Synthetic demo creator | Account | Niche | Terms |
|---|---|---|---|
| Asha | `likeness-synth-asha.testnet` | Lifestyle & food | 0.04 NEAR per render; Food & drink, Travel, Fashion, Beauty; up to 10 renders, 30 days |
| Maya Lindqvist | `likeness-synth-maya.testnet` | Fitness | 0.05 NEAR per render; Fitness, Fashion, Beauty; up to 8 renders, 21 days |

As a brand, the brief form starts with an example (a morning-coffee campaign for a café, Food & drink, 30 days,
1 render), ready to edit; **Find creators** screens it, filters and ranks the creators, and shows the agent's top 3.

Decisions for the synthetic creators (approving a licence or an ad) are made by the operator with their own testnet keys
(`pnpm -C web seed:synthetic approve-licence|approve-render …`), and labelled as such: there is no person to consent. Anyone else who signs in with a NEAR wallet is a **brand**: fund an escrow, set limits,
add the agent's key and brief the agent, which asks the creators for a licence.

The author's account is both a creator and a brand: it alone gets a **Creator | Brand** switch. A licence it grants
itself is labelled **"Self-licence (demo)"** in the app, the agent's
activity log, Verify and the standalone verifier, and its payment moves from the account's escrow back to itself.
The consent rules don't change: the creator still approves every licence and every ad from their own wallet, and the
agent's function-call key can only call `request_licence` and `submit_render`, never an approval.

## What runs where (and what's private)

- **Images:** every ad image is an edit of the creator's reference photo made on **NEAR AI Cloud** (FLUX.2-klein-4B).
  Qwen on NEAR AI Cloud then screens the ad alone for safety: a minor or sexualised content blocks it; other people in it
  regenerate it once, then drop it. **No AI judges whether the ad shows the creator** (an identity check was removed on
  13 Nov after a false positive in our live run): only the creator can confirm it's them, by approving that exact file.
  Every receipt records `needs_creator_review`. The brief, the creator ranking and the banned-use screen also run
  there. These calls run in NEAR AI's private (TEE) inference; the privacy claim of this project covers **images only**.
- **Video (optional, off unless `VIDEO_ENABLED=true`):** a short clip (4 s, 720p, 16:9, no audio) made by
  **Google Gemini Omni Flash** on its public API, **outside NEAR AI's TEE**. It starts from an ad image the creator has
  already approved (that image is the first frame) and only for creators who turned on "Allow video" in their profile
  (off by default). The clip is stored as uploaded (sha256 over the stored bytes), submitted with `submit_render`
  (`needs_creator_review`: no frames are compared), counts toward the licence's render cap, and is paid only when the
  creator approves it, like any ad. It carries the label "AI-generated video · licensed likeness" over the player and in
  its record; the pixels aren't re-encoded. Caps: about $0.41 estimated per clip, refused over $0.50; 3 clips a day
  site-wide. `pnpm -C web video:dry <licenceId> <approved sha256>` prints the exact request and the caps without
  calling anything. Storage is local (Neon) for now; the video key goes in `web/.env.local` under the variable named in
  `web/lib/video/config.ts`.
- **On-chain (NEAR testnet):** terms, licences (non-transferable tokens), escrow, receipts by sha256, payments.
- **Verify** hashes an image or video file in your browser (it's never uploaded) and asks the contract.

## Layout

- `web/`: the Next.js app (pages and API routes), deployed on Vercel.
- `contract/`: the Rust NEAR contract (testnet).

## Local setup

```sh
pnpm -C web install
cp .env.example web/.env.local   # then fill in the values
pnpm -C web dev
```

Licence: MIT.
