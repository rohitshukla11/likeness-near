"use client";

/**
 * 3 · Agent key, compact: the agent's function-call key on the brand's own account (read from the chain), shortened
 * with a copy button. It can call only request_licence and submit_render on the Likeness contract, can't attach
 * deposits, and has a 0.25 NEAR gas allowance. Add it with one AddKey; the red kill switch deletes it (DeleteKey),
 * which stops the agent at once.
 */
import { useCallback, useEffect, useState } from "react";
import { btnClass } from "@/components/ds";
import { runTx, type TxState } from "@/components/likeness/TxLine";
import { api } from "@/lib/api";
import { CONTRACT_ID, contractConfigured } from "@/lib/near/config";
import { AGENT_ALLOWANCE, AGENT_METHODS } from "@/lib/near/methods";
import { accessKeys, type AccessKey } from "@/lib/near/view";
import { useWallet } from "@/lib/near/wallet";
import type { AgentKeyInfo } from "@/lib/types";
import { CopyButton, SetPill, SetUpCard, shortKey, TxNote } from "./SetUp";

export function AgentKeyCard({ accountId, onStatus }: { accountId: string; onStatus?: (onChain: boolean) => void }) {
  const w = useWallet();
  const [keys, setKeys] = useState<AccessKey[] | null>(null);
  const [agent, setAgent] = useState<AgentKeyInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [k, a] = await Promise.allSettled([accessKeys(accountId), api<AgentKeyInfo>("/api/agent-key")]);
      if (cancelled) return;
      if (k.status === "fulfilled") setKeys(k.value);
      if (a.status === "fulfilled") setAgent(a.value);
      setLoadError(k.status === "rejected" ? "Couldn't read your keys from NEAR." : a.status === "rejected" ? "This server has no agent key configured." : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, reload]);

  const onChain = !!agent && !!keys?.some((k) => k.publicKey === agent.publicKey);
  useEffect(() => {
    if (keys && agent) onStatus?.(onChain);
  }, [keys, agent, onChain, onStatus]);
  const busy = tx.kind === "busy";

  return (
    <SetUpCard n={3} title="Agent key" pill={<SetPill ok={onChain} yes="Active" no={keys && agent ? "Not added" : "Checking…"} />}>
      {agent ? (
        <div className="flex items-center justify-between gap-2">
          <code className="min-w-0 truncate text-[13px]" title={agent.publicKey}>
            {shortKey(agent.publicKey)}
          </code>
          <CopyButton text={agent.publicKey} label="Copy the agent's public key" />
        </div>
      ) : (
        <p className="m-0 text-[13px] text-grey">{loadError ?? "Reading the key…"}</p>
      )}
      <p className="m-0 text-[13px] text-grey">Can request and submit · can&apos;t move NEAR</p>
      <div className="mt-auto">
        {agent && onChain ? (
          <button
            type="button"
            disabled={busy}
            className="min-h-11 w-full rounded-[12px] border-2 border-bad/60 px-4 text-[14px] font-semibold text-bad hover:bg-bad-bg disabled:opacity-60"
            onClick={async () => {
              if (await runTx(setTx, "Delete the agent key", () => w.send(accountId, [{ type: "DeleteKey", params: { publicKey: agent.publicKey } }]))) refresh();
            }}
          >
            Kill switch: delete key
          </button>
        ) : agent ? (
          <button
            type="button"
            disabled={!contractConfigured() || busy}
            className={btnClass("lime", "min-h-11 w-full")}
            title={`A function-call key: ${AGENT_METHODS.join(", ")} only`}
            onClick={async () => {
              const ok = await runTx(setTx, "Add the agent key", () =>
                w.send(accountId, [{ type: "AddKey", params: { publicKey: agent.publicKey, accessKey: { permission: { receiverId: CONTRACT_ID, allowance: AGENT_ALLOWANCE, methodNames: [...AGENT_METHODS] } } } }]),
              );
              if (ok) refresh();
            }}
          >
            Add key (one AddKey)
          </button>
        ) : null}
      </div>
      <TxNote s={tx} />
    </SetUpCard>
  );
}
