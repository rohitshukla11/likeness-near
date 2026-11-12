/**
 * NEAR settings for the browser and the server. Testnet only: any other network value is refused, so nothing here
 * can ever sign or read on mainnet.
 */
export const NETWORK = "testnet" as const;
if (process.env.NEXT_PUBLIC_NEAR_NETWORK && process.env.NEXT_PUBLIC_NEAR_NETWORK !== NETWORK) {
  throw new Error(`NEXT_PUBLIC_NEAR_NETWORK must be "testnet" (got "${process.env.NEXT_PUBLIC_NEAR_NETWORK}")`);
}

/** The Likeness contract's account; empty until it's deployed (pages then say "Not connected yet"). */
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID ?? "";
export const contractConfigured = () => CONTRACT_ID !== "";

/** Public testnet RPC for view calls from the browser. */
export const RPC_URL = process.env.NEXT_PUBLIC_NEAR_RPC_URL || "https://rpc.testnet.near.org";

export const EXPLORER = "https://testnet.nearblocks.io";
export const txUrl = (hash: string) => `${EXPLORER}/txns/${hash}`;
export const accountUrl = (id: string) => `${EXPLORER}/address/${id}`;
