/** Hashing in the browser: an ad's bytes as the creator's page fetched them, to compare with the on-chain receipt. */

/** sha256 of bytes as 64 lowercase hex characters. */
export async function sha256OfBytes(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}
