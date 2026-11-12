import type { Metadata } from "next";
import Link from "next/link";
import { AppPage, Card } from "@/components/ds";

export const metadata: Metadata = { title: "How it works" };

/** How Likeness works, in order: where the agent proposes and where only the creator can say yes. */
const FLOW: [string, string][] = [
  ["Connect a NEAR wallet", "Creators and brands both sign in with their own NEAR wallet (testnet). Likeness never holds a creator's or a brand's keys."],
  ["Creators capture and set terms", "A live camera capture with a blink-and-turn check, stored privately with consent. Then terms on-chain: price per render, allowed uses, the longest licence and a render cap. The sha256 of the consented front frame is recorded with them."],
  ["Brands fund escrow and set limits", "A brand deposits NEAR into the contract and sets a maximum per render and a total budget. The contract refuses anything over them."],
  ["The brand adds its agent's key", "One AddKey from the brand's wallet: a function-call key that may call only request_licence and submit_render, can't attach deposits, and has a 0.25 NEAR gas allowance. Deleting it stops the agent at once."],
  ["The agent asks; the creator approves the licence", "The agent picks creators whose terms fit and asks for a licence. Banned uses (political, adult, minors, impersonation, deception) are refused before anything is asked. The creator approves or declines; approving mints a non-transferable licence token to the brand."],
  ["The agent makes an ad; the creator approves the ad", "Each ad is an AI edit of the creator's consented photo, with an advisory AI similarity check (not identity verification). Submitting it reserves the price from escrow. The creator sees that exact file and approves it in their wallet, bound to its sha256, or rejects it (a rejection doesn't count toward the cap)."],
  ["Paid per render, verifiable by anyone", "Approval pays the creator from the reservation and records the receipt. Anyone can verify a file: Licensed, Expired, Revoked or Unknown. Revoking releases every pending reservation in the same transaction."],
];

export default function HowPage() {
  return (
    <AppPage title="How it works" description="Agents propose. Only the creator consents to their face being used.">
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {FLOW.map(([t, b], i) => (
          <li key={t}>
            <Card title={`${i + 1}. ${t}`}>
              <p className="m-0 text-[15px] leading-relaxed">{b}</p>
            </Card>
          </li>
        ))}
      </ol>
      <p className="m-0 text-[14px] text-grey">
        Not built: video. The similarity check is advisory and never releases a payment. <Link href="/verify">Verify an ad</Link>
      </p>
    </AppPage>
  );
}
