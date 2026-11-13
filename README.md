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

Decisions for them (approving a licence or an ad) are made by the operator with their own testnet keys
(`pnpm -C web seed:synthetic approve-licence|approve-render …`), and labelled as such: there is no person to consent. Anyone else who signs in with a NEAR wallet is a **brand**: fund an escrow, set limits,
add the agent's key and brief the agent, which asks the creators for a licence.

The author's account is both a creator and a brand: it alone gets a **Creator | Brand** switch. A licence it grants
itself is labelled **"Self-licence (demo)"** in the app, the agent's
activity log, Verify and the standalone verifier, and its payment moves from the account's escrow back to itself.
The consent rules don't change: the creator still approves every licence and every ad from their own wallet, and the
agent's function-call key can only call `request_licence` and `submit_render`, never an approval.

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
