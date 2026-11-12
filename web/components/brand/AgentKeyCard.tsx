"use client";

/**
 * The agent's key on the brand's own account: a function-call key that can call only request_licence and
 * submit_render on the Likeness contract, can't attach deposits, and has a 0.25 NEAR gas allowance. The brand adds it
 * with one AddKey and can delete it at any time (the kill switch). Every key on the account is listed, read from the
 * chain. If the wallet won't sign AddKey/DeleteKey, the near-cli-rs commands do the same.
 */
import { useCallback, useEffect, useState } from "react";
import { btnClass, Card, Details, ErrorCard, StatusPill } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { runTx, TxLine, type TxState } from "@/components/likeness/TxLine";
import { api, NotConnectedError } from "@/lib/api";
import { CONTRACT_ID, contractConfigured } from "@/lib/near/config";
import { AGENT_ALLOWANCE, AGENT_METHODS } from "@/lib/near/methods";
import { accessKeys, type AccessKey } from "@/lib/near/view";
import { useWallet } from "@/lib/near/wallet";
import { formatNear } from "@/lib/rules";
import type { AgentKeyInfo } from "@/lib/types";

export function AgentKeyCard({ accountId }: { accountId: string }) {
  const w = useWallet();
  const [keys, setKeys] = useState<AccessKey[] | null>(null);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentKeyInfo | null>(null);
  const [agentError, setAgentError] = useState<unknown>(null);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const k = await accessKeys(accountId);
        if (!cancelled) setKeys(k);
      } catch (e) {
        if (!cancelled) setKeysError((e as Error).message);
      }
      try {
        const a = await api<AgentKeyInfo>("/api/agent-key");
        if (!cancelled) setAgent(a);
      } catch (e) {
        if (!cancelled) setAgentError(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, reload]);

  const agentOnChain = !!agent && !!keys?.some((k) => k.publicKey === agent.publicKey);
  const contractKeys = keys?.filter((k) => !k.fullAccess && k.receiverId === CONTRACT_ID) ?? [];
  const pk = agent?.publicKey ?? "ed25519:<AGENT_PUBLIC_KEY>";

  return (
    <Card title="Your agent's key">
      <p className="m-0 text-[14px] text-grey">
        A function-call key on <b>{accountId}</b>: it may call only {AGENT_METHODS.join(" and ")} on the Likeness contract, can&apos;t move your
        NEAR, and has a {formatNear(AGENT_ALLOWANCE)} gas allowance. Delete it and your agent stops at once.
      </p>
      {agentError instanceof NotConnectedError ? (
        <NotConnected what="The agent's key (/api/agent-key)" />
      ) : agentError ? (
        <ErrorCard>{(agentError as Error).message}</ErrorCard>
      ) : null}
      {agent && (
        <div className="flex flex-wrap items-center gap-3">
          <code className="break-all text-[13px]">{agent.publicKey}</code>
          {agentOnChain ? <StatusPill kind="licensed">On your account</StatusPill> : <StatusPill kind="waiting">Not added yet</StatusPill>}
          {!agentOnChain && (
            <button
              type="button"
              disabled={!contractConfigured() || tx.kind === "busy"}
              className={btnClass("lime")}
              onClick={async () => {
                const ok = await runTx(setTx, "Add the agent key", () =>
                  w.send(accountId, [{ type: "AddKey", params: { publicKey: agent.publicKey, accessKey: { permission: { receiverId: CONTRACT_ID, allowance: AGENT_ALLOWANCE, methodNames: [...AGENT_METHODS] } } } }]),
                );
                if (ok) refresh();
              }}
            >
              Add it (one AddKey in your wallet)
            </button>
          )}
        </div>
      )}
      <TxLine s={tx} />

      <h3 className="m-0 mt-2 text-[15px] font-semibold">Keys on {accountId} for this contract</h3>
      {keysError && <ErrorCard>{keysError}</ErrorCard>}
      {!contractConfigured() ? (
        <NotConnected what="The Likeness contract" />
      ) : keys && contractKeys.length === 0 ? (
        <p className="m-0 text-[14px] text-grey">None: no agent can act for you.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {contractKeys.map((k) => (
            <li key={k.publicKey} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-line p-3 text-[13px]">
              <span className="min-w-0">
                <code className="break-all">{k.publicKey}</code>
                <span className="block text-grey">
                  {k.methodNames?.join(", ") || "any method"} · allowance {k.allowance ? formatNear(k.allowance) : "unlimited"}
                  {agent?.publicKey === k.publicKey ? " · your agent" : ""}
                </span>
              </span>
              <button
                type="button"
                disabled={tx.kind === "busy"}
                className={btnClass("danger")}
                onClick={async () => {
                  if (await runTx(setTx, "Delete the key", () => w.send(accountId, [{ type: "DeleteKey", params: { publicKey: k.publicKey } }]))) refresh();
                }}
              >
                Delete (kill switch)
              </button>
            </li>
          ))}
        </ul>
      )}

      <Details summary="If your wallet won't sign AddKey or DeleteKey">
        <p className="m-0 mb-2 text-[13px] text-grey">The same with near-cli-rs, signed by your own keychain:</p>
        <pre className="m-0 overflow-x-auto whitespace-pre-wrap rounded-[12px] bg-ink p-3 text-[12px] text-white">
          {`near account add-key ${accountId} grant-function-call-access --allowance '${formatNear(AGENT_ALLOWANCE)}' \\
  --contract-account-id ${CONTRACT_ID || "<contract>"} --function-names '${AGENT_METHODS.join(", ")}' \\
  use-manually-provided-public-key ${pk} network-config testnet sign-with-keychain send

near account list-keys ${accountId} network-config testnet now

near account delete-keys ${accountId} public-keys ${pk} network-config testnet sign-with-keychain send`}
        </pre>
      </Details>
    </Card>
  );
}
