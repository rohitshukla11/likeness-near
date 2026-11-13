"use client";

/**
 * A brand's own controls on one licence, each a transaction from its wallet: cancel a request the creator hasn't
 * answered (cancel_licence_request), or, once a licence has expired with ads still waiting on the creator, release
 * those reservations back to the escrow (release_expired). Nothing shows when neither applies.
 */
import { useState } from "react";
import { btnClass } from "@/components/ds";
import { runTx, TxLine, type TxState } from "@/components/likeness/TxLine";
import { calls } from "@/lib/near/methods";
import { useWallet } from "@/lib/near/wallet";
import type { LicenceView } from "@/lib/types";

export function LicenceActions({ l, onDone }: { l: LicenceView; onDone: () => void }) {
  const w = useWallet();
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const cancel = l.status === "Pending";
  const release = l.status === "Expired" && l.state === "Active" && l.rendersReserved > 0;
  if (!cancel && !release) return null;
  const busy = tx.kind === "busy";
  return (
    <div className="flex flex-col gap-1">
      {cancel ? (
        <button
          type="button"
          disabled={busy}
          className={btnClass("ghost", "min-h-8 self-start px-0")}
          onClick={async () => {
            if (await runTx(setTx, "Cancel the request", () => w.call(calls.cancelLicenceRequest(l.id)))) onDone();
          }}
        >
          Cancel request
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          className={btnClass("lime", "min-h-9 self-start")}
          onClick={async () => {
            if (await runTx(setTx, "Release the expired reservations", () => w.call(calls.releaseExpired(l.id)))) onDone();
          }}
        >
          Release {l.rendersReserved} reserved
        </button>
      )}
      <TxLine s={tx} />
    </div>
  );
}
