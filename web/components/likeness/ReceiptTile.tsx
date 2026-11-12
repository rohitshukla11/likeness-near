/**
 * One ad as a tile: the exact file (served by our API, private until approved), its receipt status, the amount and
 * a Verify link once it's approved.
 */
import Link from "next/link";
import { AiTag, StatusPill, type PillKind } from "@/components/ds";
import { formatNear } from "@/lib/rules";
import type { RenderItem, ReceiptStatus } from "@/lib/types";
import { SelfLicenceBadge } from "./SelfLicence";
import { SyntheticBadge } from "./Synthetic";

const PILL: Record<ReceiptStatus, PillKind> = { Reserved: "waiting", Approved: "licensed", Rejected: "revoked", Released: "expired" };
const LABEL: Record<ReceiptStatus, string> = { Reserved: "Waiting for you", Approved: "Approved, paid", Rejected: "Rejected", Released: "Released (not paid)" };

export function ReceiptTile({ item, href }: { item: RenderItem; href?: string }) {
  const r = item.receipt;
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-[20px] bg-white p-3 text-[14px]">
      <div className="relative aspect-square overflow-hidden rounded-[14px] bg-paper">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.mediaUrl} alt={`Ad for ${item.licence.brand}`} loading="lazy" className="h-full w-full object-cover" />
        <AiTag className="absolute left-2 top-2" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusPill kind={PILL[r.status]}>{LABEL[r.status]}</StatusPill>
        <span className="font-semibold">{formatNear(r.amount)}</span>
      </div>
      <span className="truncate text-grey" title={item.licence.brand}>
        {item.licence.brand}
      </span>
      <SelfLicenceBadge l={item.licence} />
      <SyntheticBadge accountId={item.licence.creator} />
      <span className="flex gap-3">
        {href && (
          <Link href={href} className="underline">
            Open
          </Link>
        )}
        {r.status === "Approved" && (
          <Link href={`/verify?sha256=${r.sha256}`} className="underline">
            Verify
          </Link>
        )}
      </span>
    </article>
  );
}
