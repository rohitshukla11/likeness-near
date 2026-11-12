/**
 * The Likeness contract's change methods as the app calls them: names, argument shapes (snake_case JSON, as the
 * contract reads them), gas and attached deposits. One place, shared by the wallet calls in the browser and the
 * agent's function-call key on the server. u64 and u128 travel as decimal strings.
 */
import type { Sha256Hex, Yocto } from "../types";
import type { Use } from "../rules";

export const TGAS = 10n ** 12n;
export const gas = (tgas: number) => (BigInt(tgas) * TGAS).toString();
export const NEAR = 10n ** 24n;

/** Storage a creator attaches to register (their record and its index entry); the contract refunds any excess. */
export const REGISTER_DEPOSIT: Yocto = (NEAR / 100n).toString(); // 0.01 NEAR

export interface TermsArgs {
  price_per_render: Yocto;
  allowed_uses: Use[];
  max_days: number;
  render_cap: number;
}

/** Each method: its JSON args, and the gas/deposit the call needs. */
export type ContractCall =
  | { method: "register_creator"; args: { terms: TermsArgs; capture_sha256: Sha256Hex }; deposit: Yocto; gas: string }
  | { method: "update_terms"; args: { terms: TermsArgs }; deposit: "0"; gas: string }
  | { method: "set_active"; args: { active: boolean }; deposit: "0"; gas: string }
  | { method: "approve_licence" | "decline_licence" | "revoke_licence" | "cancel_licence_request" | "release_expired"; args: { licence_id: string }; deposit: "0"; gas: string }
  | { method: "approve_render" | "reject_render"; args: { sha256: Sha256Hex }; deposit: "0"; gas: string }
  | { method: "deposit"; args: Record<string, never>; deposit: Yocto; gas: string }
  | { method: "set_limits"; args: { max_per_render: Yocto; total_budget: Yocto }; deposit: "0"; gas: string }
  | { method: "withdraw"; args: { amount: Yocto }; deposit: "0"; gas: string }
  | { method: "claim_unclaimed"; args: Record<string, never>; deposit: "0"; gas: string };

export const calls = {
  registerCreator: (terms: TermsArgs, captureSha256: Sha256Hex): ContractCall => ({ method: "register_creator", args: { terms, capture_sha256: captureSha256 }, deposit: REGISTER_DEPOSIT, gas: gas(30) }),
  updateTerms: (terms: TermsArgs): ContractCall => ({ method: "update_terms", args: { terms }, deposit: "0", gas: gas(30) }),
  setActive: (active: boolean): ContractCall => ({ method: "set_active", args: { active }, deposit: "0", gas: gas(30) }),
  approveLicence: (id: string): ContractCall => ({ method: "approve_licence", args: { licence_id: id }, deposit: "0", gas: gas(30) }),
  declineLicence: (id: string): ContractCall => ({ method: "decline_licence", args: { licence_id: id }, deposit: "0", gas: gas(30) }),
  revokeLicence: (id: string): ContractCall => ({ method: "revoke_licence", args: { licence_id: id }, deposit: "0", gas: gas(50) }),
  cancelLicenceRequest: (id: string): ContractCall => ({ method: "cancel_licence_request", args: { licence_id: id }, deposit: "0", gas: gas(30) }),
  releaseExpired: (id: string): ContractCall => ({ method: "release_expired", args: { licence_id: id }, deposit: "0", gas: gas(50) }),
  /** Pays the creator (a transfer plus its callback), so more gas. */
  approveRender: (sha256: Sha256Hex): ContractCall => ({ method: "approve_render", args: { sha256 }, deposit: "0", gas: gas(60) }),
  rejectRender: (sha256: Sha256Hex): ContractCall => ({ method: "reject_render", args: { sha256 }, deposit: "0", gas: gas(30) }),
  deposit: (amount: Yocto): ContractCall => ({ method: "deposit", args: {}, deposit: amount, gas: gas(30) }),
  setLimits: (maxPerRender: Yocto, totalBudget: Yocto): ContractCall => ({ method: "set_limits", args: { max_per_render: maxPerRender, total_budget: totalBudget }, deposit: "0", gas: gas(30) }),
  withdraw: (amount: Yocto): ContractCall => ({ method: "withdraw", args: { amount }, deposit: "0", gas: gas(60) }),
  claimUnclaimed: (): ContractCall => ({ method: "claim_unclaimed", args: {}, deposit: "0", gas: gas(60) }),
} as const;

/** The only methods the agent's function-call key may call (the AddKey permission lists exactly these). */
export const AGENT_METHODS = ["request_licence", "submit_render"] as const;
/** The agent key's lifetime gas allowance: 0.25 NEAR. */
export const AGENT_ALLOWANCE: Yocto = (NEAR / 4n).toString();
