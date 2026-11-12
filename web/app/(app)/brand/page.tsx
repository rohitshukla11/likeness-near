"use client";

/** The brand workspace on its own page (the dashboard's Brand tab shows the same thing). */
import { AppPage, btnClass, Card } from "@/components/ds";
import { BrandWorkspace } from "@/components/brand/BrandWorkspace";
import { useWallet } from "@/lib/near/wallet";

export default function BrandPage() {
  const w = useWallet();
  if (!w.accountId)
    return (
      <AppPage title="Brand workspace">
        <Card tone="lime" title="Connect the brand's NEAR wallet">
          <p className="m-0 text-[15px]">Testnet only. Your wallet funds the escrow, sets the limits and adds (or deletes) your agent&apos;s key.</p>
          <button type="button" className={btnClass("ink", "self-start")} onClick={() => void w.connect().catch(() => undefined)}>
            Connect NEAR wallet
          </button>
        </Card>
      </AppPage>
    );
  return (
    <AppPage title="Brand workspace" description={`${w.accountId} (testnet). Your agent proposes; creators decide. The same account can also be a creator.`}>
      <BrandWorkspace accountId={w.accountId} />
    </AppPage>
  );
}
