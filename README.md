# Likeness on NEAR

Creators license their face to AI ads: a price per render, the uses they allow, a render cap and an expiry. They
approve every licence and every ad, are paid per render from the brand's escrow on NEAR, and can revoke at any time.
A brand's AI agent proposes the renders; every ad has a receipt anyone can verify as Licensed, Expired, Revoked or
Unknown.

Built for NEAR HACKATHON 2026, from FaceVisa (GitHub: rohitshukla11/eth_mumbai @ b1976e4).

> Work in progress. The full README (try it, run it, what's on-chain) lands with the docs commit.

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
