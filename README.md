# Likeness on NEAR

Creators license their face to AI ads: a price per render, the uses they allow, a render cap and an expiry. They
approve every licence and every ad, are paid per render from the brand's escrow on NEAR, and can revoke at any time.
A brand's AI agent proposes the renders; every ad has a receipt anyone can verify as Licensed, Expired, Revoked or
Unknown.

**Live demo (NEAR testnet):** https://likenesss.onrender.com · Video is disabled on the hosted demo to cap costs; see the
demo video.

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

- **Try the agent, no wallet needed:** `/try` runs "Find creators" in demo mode for any visitor (signed in or not): the
  banned-use screen, then the agent's top 3 with reasons and the "Not eligible" list. Nothing is stored or requested
  on-chain; it's rate-limited per IP and counts toward the daily AI cap. Licence requests run only for the brand that
  holds the server's agent key.
- **Verify a real receipt:** the Verify page's "Try with a real receipt" opens an ad from our live run (approved and paid
  on testnet, then its licence was revoked, so it reads Revoked).

## What runs where (and what's private)

- **Images:** every ad image is an edit of the creator's reference photo made on **NEAR AI Cloud** (FLUX.2-klein-4B).
  Qwen on NEAR AI Cloud then screens the ad alone for safety: a minor or sexualised content blocks it; other people in it
  regenerate it once, then drop it; if the screen gives no valid answer, it's asked once more, and still none drops the
  ad (fail closed). **No AI judges whether the ad shows the creator** (an identity check was removed on
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

Mitigations in the app: **the creator reviews and approves every image** (nothing is paid before that, and no AI says
whether it's really them); **the safety screen** blocks minors and sexualised content, regenerates once and then drops an
ad with other people in it, and fails closed. An earlier AI identity check was removed after it rated an ad that wasn't
the author "likely the same person, 0.95".

Feedback for NEAR AI: an identity-preserving image-edit model (or reference-image conditioning) on NEAR AI Cloud would
remove this limitation. Not built here: an exact-likeness composite (the creator's own pixels over a generated
background), kept as a documented fallback.

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
