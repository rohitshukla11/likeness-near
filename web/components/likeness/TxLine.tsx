"use client";

/**
 * The outcome of one wallet action, in a line: the transaction on the explorer, or why it didn't happen. A contract
 * that isn't deployed in this build reads "Not connected yet", never as a fake success.
 */
import { NotConnected } from "@/components/ds/NotConnected";
import { txUrl } from "@/lib/near/config";
import { ContractNotConfigured } from "@/lib/near/wallet";
import { NotConnectedError } from "@/lib/api";

export type TxState = { kind: "idle" } | { kind: "busy"; what: string } | { kind: "done"; what: string; hash: string | null } | { kind: "error"; error: unknown };

export function TxLine({ s }: { s: TxState }) {
  if (s.kind === "idle") return null;
  if (s.kind === "busy") return <p className="m-0 text-[14px] text-grey">{s.what}: waiting for your wallet…</p>;
  if (s.kind === "done")
    return (
      <p className="m-0 text-[14px] text-ok">
        {s.what}: done.{" "}
        {s.hash && (
          <a href={txUrl(s.hash)} target="_blank" rel="noreferrer" className="underline">
            View the transaction<span className="sr-only"> (opens the explorer)</span>
          </a>
        )}
      </p>
    );
  if (s.error instanceof ContractNotConfigured) return <NotConnected what="The Likeness contract" />;
  if (s.error instanceof NotConnectedError) return <NotConnected what={`This step (${s.error.path})`} />;
  return (
    <p role="alert" className="m-0 text-[14px] text-bad">
      {(s.error as Error)?.message ?? String(s.error)}
    </p>
  );
}

/** Runs a wallet action and reports it through `set`. */
export async function runTx(set: (s: TxState) => void, what: string, fn: () => Promise<{ hash: string | null }>) {
  set({ kind: "busy", what });
  try {
    const r = await fn();
    set({ kind: "done", what, hash: r.hash });
    return true;
  } catch (error) {
    set({ kind: "error", error });
    return false;
  }
}
