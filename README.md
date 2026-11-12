# Likeness on NEAR

Creators license their face to AI ads: a price per render, the uses they allow, a render cap and an expiry. They
approve every licence and every ad, are paid per render from the brand's escrow on NEAR, and can revoke at any time.
A brand's AI agent proposes the renders; every ad has a receipt anyone can verify as Licensed, Expired, Revoked or
Unknown.

Built for NEAR HACKATHON 2026, from FaceVisa (GitHub: rohitshukla11/eth_mumbai @ b1976e4).

> Work in progress. The full README (try it, run it, what's on-chain) lands with the docs commit.

## One account, both roles (demos)

One NEAR account can be both a creator and a brand: sign in once, then switch between **Creator** and **Brand** on
the dashboard. A licence the account grants itself is labelled **"Self-licence (demo)"** in the app, the agent's
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
