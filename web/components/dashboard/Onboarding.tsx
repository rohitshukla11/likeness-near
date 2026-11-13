"use client";

/**
 * Becoming a creator: register terms on NEAR from your own wallet. Proving your likeness (a live camera capture) is
 * optional and can be done now or later from the dashboard; until then the creator reads "Likeness not proven".
 */
import { useState } from "react";
import { Card, StatusPill } from "@/components/ds";
import { ProveLikeness } from "@/components/likeness/ProveLikeness";
import { RulesForm } from "@/components/likeness/RulesForm";
import { runTx, TxLine, type TxState } from "@/components/likeness/TxLine";
import { calls, NOT_PROVEN } from "@/lib/near/methods";
import { useWallet } from "@/lib/near/wallet";
import type { MeResponse } from "@/lib/types";

export function Onboarding({ me, onDone }: { me: MeResponse | null; onDone: () => void }) {
  const w = useWallet();
  const [captureSha, setCaptureSha] = useState<string | null>(me?.capture?.captureSha256 ?? null);
  const [prove, setProve] = useState(false);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });

  return (
    <div className="flex flex-col gap-[18px]">
      <Card title="Register as a creator on NEAR">
        <p className="m-0 text-[15px] text-grey">
          Set your price per render, the uses you allow, the longest licence and a render cap. Brands&apos; agents can only ask; you approve every licence
          and every ad yourself.
        </p>
        <RulesForm
          submitLabel="Register on NEAR"
          onSubmit={async (terms) => {
            const ok = await runTx(setTx, "Register as a creator", () => w.call(calls.registerCreator(terms, captureSha ?? NOT_PROVEN)));
            if (ok) onDone();
          }}
        />
        <TxLine s={tx} />
      </Card>

      <Card
        title="Prove your likeness (optional)"
        action={captureSha ? <StatusPill kind="licensed">Likeness proven</StatusPill> : <StatusPill kind="neutral">Likeness not proven</StatusPill>}
      >
        {captureSha ? (
          <p className="m-0 text-[15px]">
            Saved with your consent; it&apos;s recorded on NEAR when you register. Front frame sha256 <code className="break-all text-[13px]">{captureSha}</code>
          </p>
        ) : prove ? (
          <ProveLikeness registered={false} onProven={setCaptureSha} />
        ) : (
          <>
            <p className="m-0 text-[15px] text-grey">
              You can register without it and prove it later from your dashboard. Until then brands see &ldquo;Likeness not proven&rdquo; next to your name.
            </p>
            <button type="button" className="self-start text-[15px] font-semibold underline" onClick={() => setProve(true)}>
              Prove it now
            </button>
          </>
        )}
      </Card>
    </div>
  );
}
