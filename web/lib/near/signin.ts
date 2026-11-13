/**
 * Signing in to our API with a NEAR account (NEP-413): the server issues a one-time challenge, the wallet signs it,
 * the server checks the signature against the account's on-chain full-access keys and sets an HttpOnly session cookie.
 * No key or token is kept in the browser.
 */
import { api } from "../api";

export interface Challenge {
  message: string;
  recipient: string;
  /** 32 random bytes, base64. */
  nonce: string;
}

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export async function signInToApi(signMessage: (message: string, recipient: string, nonce: Uint8Array) => Promise<{ accountId: string; publicKey: string; signature: string }>) {
  const ch = await api<Challenge>("/api/auth/challenge", {});
  const signed = await signMessage(ch.message, ch.recipient, b64ToBytes(ch.nonce));
  await api("/api/auth/verify", { ...signed, message: ch.message, recipient: ch.recipient, nonce: ch.nonce });
  announceSession();
}

export async function signOutOfApi() {
  try {
    await api("/api/auth/logout", {});
  } finally {
    announceSession();
  }
}

/** Tells every useSessionAccount() on the page that the sign-in session changed (signed in or out). */
export const SESSION_EVENT = "likeness:session";
export function announceSession() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EVENT));
}
