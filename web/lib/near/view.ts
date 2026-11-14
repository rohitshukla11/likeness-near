/**
 * Read-only NEAR RPC calls (browser or server): contract view methods and an account's access keys. Public data only;
 * nothing here signs. The contract's views return snake_case JSON (shapes below); mappers turn them into lib/types.
 */
import { CONTRACT_ID, RPC_URL } from "./config";
import type { Use } from "../rules";
import type { BrandView, CreatorView, FaceCheck, LicenceState, LicenceStatus, LicenceView, ReceiptStatus, ReceiptView, Verdict, VerifyResult } from "../types";

export class ViewError extends Error {}

/**
 * Public testnet RPCs, tried in order: the configured one, then FastNEAR's, then NEAR's own. The public
 * rpc.testnet.near.org is slow and rate-limited for shared cloud IPs (our host), so a 429, a 5xx, a network error or an
 * 8 s timeout moves on to the next. A contract-level answer (an error the contract returned) is final.
 */
// rpc.testnet.near.org is deprecated (it answers every call with -429 "STOP USING IT"): fastnear only.
const FALLBACK_RPCS = ["https://rpc.testnet.fastnear.com"];
const RPC_TIMEOUT_MS = 8_000;

class RpcUnavailable extends Error {}

async function rpcOnce<T>(rpcUrl: string, params: object): Promise<T> {
  let r: Response;
  try {
    r = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "likeness", method: "query", params }),
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    });
  } catch (e) {
    throw new RpcUnavailable(`${new URL(rpcUrl).host}: ${(e as Error).name === "TimeoutError" ? "timed out" : "unreachable"}`);
  }
  if (r.status === 429 || r.status >= 500) throw new RpcUnavailable(`${new URL(rpcUrl).host}: HTTP ${r.status}`);
  if (!r.ok) throw new ViewError(`NEAR RPC answered HTTP ${r.status}`);
  const j = (await r.json()) as { result?: T & { error?: string }; error?: { data?: string; message?: string; cause?: { name?: string } } };
  if (j.error) throw new ViewError(j.error.cause?.name ?? j.error.data ?? j.error.message ?? "NEAR RPC error");
  if (j.result?.error) throw new ViewError(j.result.error);
  return j.result as T;
}

async function rpc<T>(params: object, rpcUrl = RPC_URL): Promise<T> {
  const tried: string[] = [];
  for (const url of [...new Set([rpcUrl, ...FALLBACK_RPCS])]) {
    try {
      return await rpcOnce<T>(url, params);
    } catch (e) {
      if (!(e instanceof RpcUnavailable)) throw e;
      tried.push(e.message);
    }
  }
  throw new ViewError(`no NEAR RPC answered (${tried.join("; ")})`);
}

const b64 = (s: string) => (typeof btoa === "function" ? btoa(s) : Buffer.from(s, "utf8").toString("base64"));

/** A contract view method's JSON result. */
export async function viewCall<T>(method: string, args: object = {}, contractId = CONTRACT_ID): Promise<T> {
  if (!contractId) throw new ViewError("no contract id configured");
  const res = await rpc<{ result: number[] }>({ request_type: "call_function", finality: "final", account_id: contractId, method_name: method, args_base64: b64(JSON.stringify(args)) });
  return JSON.parse(new TextDecoder().decode(new Uint8Array(res.result))) as T;
}

export type AccessKey = { publicKey: string; fullAccess: boolean; receiverId?: string; methodNames?: string[]; allowance?: string | null };

/** Every access key on an account (view_access_key_list). */
export async function accessKeys(accountId: string): Promise<AccessKey[]> {
  const res = await rpc<{ keys: { public_key: string; access_key: { permission: "FullAccess" | { FunctionCall: { allowance: string | null; receiver_id: string; method_names: string[] } } } }[] }>({
    request_type: "view_access_key_list",
    finality: "final",
    account_id: accountId,
  });
  return res.keys.map((k) =>
    k.access_key.permission === "FullAccess"
      ? { publicKey: k.public_key, fullAccess: true }
      : { publicKey: k.public_key, fullAccess: false, receiverId: k.access_key.permission.FunctionCall.receiver_id, methodNames: k.access_key.permission.FunctionCall.method_names, allowance: k.access_key.permission.FunctionCall.allowance },
  );
}

// ---------------------------------------------------------------- the contract's view JSON

export interface TermsJson {
  price_per_render: string;
  allowed_uses: Use[];
  max_days: number;
  render_cap: number;
}
export interface CreatorJson {
  account_id: string;
  terms: TermsJson;
  capture_sha256: string | null;
  active: boolean;
  registered_at_ms: number;
}
export interface BrandJson {
  account_id: string;
  escrow: string;
  reserved: string;
  max_per_render: string;
  total_budget: string;
  spent: string;
}
export interface LicenceJson {
  id: string;
  token_id: string | null;
  creator: string;
  brand: string;
  use: Use;
  price: string;
  render_cap: number;
  renders_used: number;
  renders_reserved: number;
  state: LicenceState;
  status: LicenceStatus;
  requested_at_ms: number;
  issued_at_ms: number | null;
  expires_at_ms: number | null;
  terms_hash: string;
}
export interface ReceiptJson {
  sha256: string;
  licence_id: string;
  amount: string;
  face_check: FaceCheck;
  status: ReceiptStatus;
  created_at_ms: number;
  decided_at_ms: number | null;
}
/** nft_token(id): NEP-171 token with NEP-177 metadata, all computed by the contract on read. */
export interface TokenJson {
  token_id: string;
  owner_id: string;
  metadata: {
    title: string | null;
    description: string | null;
    /** data:image/svg+xml;base64,… drawn by the contract from the licence's current state. */
    media: string | null;
    /** base64(sha256) of exactly the SVG in `media`. */
    media_hash: string | null;
    issued_at: string | null;
    expires_at: string | null;
    extra: string | null;
  } | null;
}

/** licence_summary(id): the licence's money and render counts, computed on read (yoctoNEAR as strings). */
export interface LicenceSummary {
  licence_id: string;
  token_id: string | null;
  status: LicenceStatus;
  price_per_render: string;
  render_cap: number;
  renders_used: number;
  renders_reserved: number;
  renders_left: number;
  paid_to_creator: string;
  reserved: string;
  refundable_on_end: string;
  expires_at_ms: number | null;
}

export interface VerifyJson {
  sha256: string;
  verdict: Verdict;
  token_id: string | null;
  licence: LicenceJson | null;
  receipt: ReceiptJson | null;
}

export const toCreator = (c: CreatorJson): CreatorView => ({
  accountId: c.account_id,
  terms: { pricePerRender: c.terms.price_per_render, allowedUses: c.terms.allowed_uses, maxDays: c.terms.max_days, renderCap: c.terms.render_cap },
  captureSha256: c.capture_sha256,
  active: c.active,
  registeredAt: c.registered_at_ms,
});
export const toBrand = (b: BrandJson): BrandView => ({ accountId: b.account_id, escrow: b.escrow, reserved: b.reserved, maxPerRender: b.max_per_render, totalBudget: b.total_budget, spent: b.spent });
export const toLicence = (l: LicenceJson): LicenceView => ({
  id: l.id,
  tokenId: l.token_id,
  creator: l.creator,
  brand: l.brand,
  use: l.use,
  price: l.price,
  renderCap: l.render_cap,
  rendersUsed: l.renders_used,
  rendersReserved: l.renders_reserved,
  state: l.state,
  status: l.status,
  requestedAt: l.requested_at_ms,
  issuedAt: l.issued_at_ms,
  expiresAt: l.expires_at_ms,
  termsHash: l.terms_hash,
});
export const toReceipt = (r: ReceiptJson): ReceiptView => ({ sha256: r.sha256, licenceId: r.licence_id, amount: r.amount, faceCheck: r.face_check, status: r.status, createdAt: r.created_at_ms, decidedAt: r.decided_at_ms });
export const toVerify = (v: VerifyJson): VerifyResult => ({ sha256: v.sha256, verdict: v.verdict, tokenId: v.token_id, licence: v.licence && toLicence(v.licence), receipt: v.receipt && toReceipt(v.receipt) });

export const views = {
  verify: async (sha256: string) => toVerify(await viewCall<VerifyJson>("verify", { sha256 })),
  getBrand: async (accountId: string) => {
    const b = await viewCall<BrandJson | null>("get_brand", { account_id: accountId });
    return b && toBrand(b);
  },
  getCreator: async (accountId: string) => {
    const c = await viewCall<CreatorJson | null>("get_creator", { account_id: accountId });
    return c && toCreator(c);
  },
  listCreators: async (from = 0, limit = 50) => (await viewCall<CreatorJson[]>("list_creators", { from_index: from, limit })).map(toCreator),
  getLicence: async (id: string) => {
    const l = await viewCall<LicenceJson | null>("get_licence", { licence_id: id });
    return l && toLicence(l);
  },
  getReceipt: async (sha256: string) => {
    const r = await viewCall<ReceiptJson | null>("get_receipt", { sha256 });
    return r && toReceipt(r);
  },
  getToken: (id: string) => viewCall<TokenJson | null>("nft_token", { token_id: id }),
  /** NEP-181: the tokens an account holds (up to 50). */
  tokensForOwner: (accountId: string) => viewCall<TokenJson[]>("nft_tokens_for_owner", { account_id: accountId, limit: 50 }),
  getLicenceSummary: (id: string) => viewCall<LicenceSummary | null>("licence_summary", { licence_id: id }),
  licencesForCreator: async (accountId: string, from = 0, limit = 50) =>
    (await viewCall<LicenceJson[]>("licences_for_creator", { creator_id: accountId, from_index: from, limit })).map(toLicence),
  licencesForBrand: async (accountId: string, from = 0, limit = 50) =>
    (await viewCall<LicenceJson[]>("licences_for_brand", { brand_id: accountId, from_index: from, limit })).map(toLicence),
};
