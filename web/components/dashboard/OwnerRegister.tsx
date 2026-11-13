"use client";

/**
 * The owner's one-time registration as the demo's creator (no creator sign-up for anyone else): his photo is already
 * stored as his reference (scripts/owner-creator.ts), so this is one register_creator transaction in his wallet with
 * that photo's sha256 and his terms.
 */
import { useState } from "react";
import { Card } from "@/components/ds";
import { BigAvatar } from "@/components/likeness/Dash";
import { RulesForm } from "@/components/likeness/RulesForm";
import { runTx, TxLine, type TxState } from "@/components/likeness/TxLine";
import { calls } from "@/lib/near/methods";
import { useWallet } from "@/lib/near/wallet";
import { OWNER } from "@/lib/profiles";
import { parseNear } from "@/lib/rules";

export function OwnerRegister({ onDone }: { onDone: () => void }) {
  const w = useWallet();
  const [tx, setTx] = useState<TxState>({ kind: "idle" });
  const t = OWNER.terms;
  return (
    <Card title="Register as the creator on NEAR">
      <div className="flex flex-wrap items-center gap-4">
        <BigAvatar src={OWNER.face} alt={OWNER.name} letter={OWNER.name[0]!} />
        <p className="m-0 min-w-0 flex-1 text-[15px] text-grey">
          {OWNER.name}: your photo is your reference for every ad (sha256 <code className="break-all text-[13px]">{OWNER.faceSha256}</code>). One
          transaction records it with your terms; you approve every licence and every ad yourself.
        </p>
      </div>
      <RulesForm
        initial={{ pricePerRender: parseNear(t.pricePerRenderNear)!.toString(), allowedUses: t.allowedUses, maxDays: t.maxDays, renderCap: t.renderCap }}
        submitLabel="Register on NEAR"
        onSubmit={async (terms) => {
          if (await runTx(setTx, "Register as the creator", () => w.call(calls.registerCreator(terms, OWNER.faceSha256)))) onDone();
        }}
      />
      <TxLine s={tx} />
    </Card>
  );
}
