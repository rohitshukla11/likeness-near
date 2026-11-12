/**
 * The brand's agent on the server: a FUNCTION-CALL key on the brand's own account (AGENT_ACCOUNT_ID), whose private
 * half lives only in AGENT_PRIVATE_KEY (web/.env.local / the host's env). The protocol limits it to request_licence and
 * submit_render on the Likeness contract, no deposits, a 0.25 NEAR gas allowance; the brand deletes it to stop the agent.
 */
import "server-only";
import { Account, JsonRpcProvider, KeyPair, type KeyPairString } from "near-api-js";
import { CONTRACT_ID, RPC_URL } from "./config";
import { AGENT_ALLOWANCE, AGENT_METHODS, gas } from "./methods";
import type { AgentKeyInfo } from "../types";

export type AgentMethod = (typeof AGENT_METHODS)[number];

export const agentAccountId = () => process.env.AGENT_ACCOUNT_ID ?? "";
export const agentConfigured = () => !!process.env.AGENT_ACCOUNT_ID && /^ed25519:/.test(process.env.AGENT_PRIVATE_KEY ?? "") && !!CONTRACT_ID;

function keyString(): KeyPairString {
  const k = process.env.AGENT_PRIVATE_KEY ?? "";
  if (!/^ed25519:/.test(k)) throw new Error("the agent key isn't configured (AGENT_PRIVATE_KEY)");
  return k as KeyPairString;
}

export function agentKeyInfo(): AgentKeyInfo {
  return {
    brand: agentAccountId(),
    publicKey: KeyPair.fromString(keyString()).getPublicKey().toString(),
    contractId: CONTRACT_ID,
    methods: [...AGENT_METHODS],
    allowance: AGENT_ALLOWANCE,
  };
}

/** One call to the contract signed by the agent's function-call key; returns the tx hash and decoded return value. */
export async function agentCall(method: AgentMethod, args: object, tgas = 50): Promise<{ hash: string; value: unknown }> {
  if (!agentConfigured()) throw new Error("the agent isn't configured on this server");
  const account = new Account(agentAccountId(), new JsonRpcProvider({ url: RPC_URL }), keyString());
  const res = await account.callFunctionRaw({ contractId: CONTRACT_ID, methodName: method, args, gas: BigInt(gas(tgas)), deposit: 0n });
  const status = res.status as { SuccessValue?: string; Failure?: unknown } | string | undefined;
  if (status && typeof status === "object" && "Failure" in status && status.Failure) throw new Error(`the contract refused ${method}: ${JSON.stringify(status.Failure).slice(0, 300)}`);
  const raw = status && typeof status === "object" ? status.SuccessValue : undefined;
  let value: unknown = null;
  if (raw) {
    try {
      value = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    } catch {
      value = null;
    }
  }
  return { hash: res.transaction.hash, value };
}
