/**
 * Sign-in with a NEAR account (NEP-413) and our own session.
 * - POST /api/auth/challenge stores a one-time 32-byte nonce (5 minutes).
 * - The wallet signs {message, recipient, nonce}; POST /api/auth/verify consumes the nonce, checks the signature
 *   with near-api-js `verifyMessage` (which also requires the key to be a FULL-ACCESS key of that account on-chain),
 *   and starts a session: a random id stored in Neon, sent as `id.hmac` in an HttpOnly, SameSite=Lax cookie.
 * - POSTs must come from our own origin (Origin header) with a JSON body: no cross-site form can forge one.
 * No token or key is ever sent back to the browser.
 */
import "server-only";
import { sameOriginOk } from "./origin";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { JsonRpcProvider } from "near-api-js";
import { verifyMessage } from "near-api-js/nep413";
import { q } from "./db";
import { HttpError } from "./http";
import { CONTRACT_ID, RPC_URL } from "./near/config";

const COOKIE = "likeness_session";
const TTL_MS = 7 * 24 * 3600 * 1000;
const CHALLENGE_TTL = "5 minutes";
export const SIGN_IN_MESSAGE = "Sign in to Likeness (NEAR testnet). This signs no transaction and costs nothing.";
export const recipient = () => CONTRACT_ID || "likeness";

function secret(): Buffer {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new HttpError(503, "sign-in isn't configured on this server (SESSION_SECRET)");
  return Buffer.from(s);
}
const mac = (id: string) => createHmac("sha256", secret()).update(id).digest("base64url");

/** POSTs only from our own pages: the Origin must match the Host (or the app's public URL), and the body must be JSON. */
export function requireSameOrigin(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!sameOriginOk(req.headers.get("origin"), host)) throw new HttpError(403, "cross-site request refused");
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) throw new HttpError(415, "send JSON");
}

export async function createChallenge() {
  const nonce = randomBytes(32).toString("base64");
  await q(`insert into auth_challenges (nonce) values ($1)`, [nonce]);
  if (Math.random() < 0.05) await q(`delete from auth_challenges where created_at < now() - interval '1 day'`);
  return { message: SIGN_IN_MESSAGE, recipient: recipient(), nonce };
}

export interface SignedIn {
  accountId: string;
  publicKey: string;
  signature: string;
  message: string;
  recipient: string;
  nonce: string;
}

export async function verifyAndStart(b: SignedIn): Promise<string> {
  if (typeof b.accountId !== "string" || !/^[a-z0-9._-]{2,64}$/.test(b.accountId)) throw new HttpError(400, "bad account id");
  if (b.message !== SIGN_IN_MESSAGE || b.recipient !== recipient()) throw new HttpError(400, "unexpected message");
  const used = await q(
    `update auth_challenges set used_at = now() where nonce = $1 and used_at is null and created_at > now() - interval '${CHALLENGE_TTL}' returning nonce`,
    [b.nonce],
  );
  if (!used.length) throw new HttpError(401, "this sign-in request expired or was already used: try again");
  try {
    await verifyMessage({
      signerAccountId: b.accountId,
      signerPublicKey: b.publicKey,
      payload: { message: b.message, recipient: b.recipient, nonce: new Uint8Array(Buffer.from(b.nonce, "base64")) },
      signature: new Uint8Array(Buffer.from(b.signature, "base64")),
      provider: new JsonRpcProvider({ url: RPC_URL }),
    });
  } catch (e) {
    throw new HttpError(401, `the signature didn't verify: ${(e as Error).message.slice(0, 160)}`);
  }
  const id = randomBytes(32).toString("base64url");
  await q(`insert into sessions (id, account_id, expires_at) values ($1, $2, now() + interval '7 days')`, [id, b.accountId]);
  (await cookies()).set(COOKIE, `${id}.${mac(id)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: TTL_MS / 1000 });
  return b.accountId;
}

/** The signed-in NEAR account, or null. */
export async function currentAccount(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw || !process.env.SESSION_SECRET) return null;
  const [id, sig] = raw.split(".");
  if (!id || !sig) return null;
  const want = Buffer.from(mac(id));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const r = await q<{ account_id: string }>(`select account_id from sessions where id = $1 and expires_at > now()`, [id]);
  return r[0]?.account_id ?? null;
}

export async function requireAccount(): Promise<string> {
  const a = await currentAccount();
  if (!a) throw new HttpError(401, "sign in with your NEAR wallet first");
  return a;
}

export async function endSession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value?.split(".")[0];
  if (id) await q(`delete from sessions where id = $1`, [id]);
  jar.delete(COOKIE);
}
