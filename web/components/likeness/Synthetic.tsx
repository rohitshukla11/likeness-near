/** Labels for synthetic demo creators (a badge, a one-line note), and every creator's avatar. */
import { Initial } from "@/components/ds";
import { profileOf } from "@/lib/profiles";
import { SYNTHETIC_DECIDER, SYNTHETIC_NOTE, syntheticOf } from "@/lib/synthetic";

export function SyntheticBadge({ accountId }: { accountId: string | null | undefined }) {
  if (!syntheticOf(accountId)) return null;
  return (
    <span
      title={`${SYNTHETIC_NOTE}. ${SYNTHETIC_DECIDER}`}
      className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#FFF1D6] px-2.5 py-1 text-[12px] font-semibold text-[#7A4B00] ring-1 ring-[#E9C27A]"
    >
      ◆ Synthetic demo creator
    </span>
  );
}

/** The full sentence, for profiles, ads, Verify and receipts. */
export function SyntheticNote({ accountId, className = "" }: { accountId: string | null | undefined; className?: string }) {
  if (!syntheticOf(accountId)) return null;
  return (
    <p className={`m-0 text-[13px] font-semibold text-wait ${className}`}>
      {SYNTHETIC_NOTE}. <span className="font-normal">{SYNTHETIC_DECIDER}</span>
    </p>
  );
}

/** A creator's public face (the owner's photo or a synthetic face); everyone else gets their initial. */
export function CreatorAvatar({ accountId, size = 56, className = "" }: { accountId: string; size?: number | "fill"; className?: string }) {
  const s = profileOf(accountId);
  if (!s) return size === "fill" ? <span className={`flex h-full w-full items-center justify-center bg-paper ${className}`}><Initial name={accountId} size={72} /></span> : <Initial name={accountId} size={size} />;
  const dim = size === "fill" ? undefined : size;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={s.face} alt={s.synthetic ? `${s.name}: AI-generated face, not a real person` : s.name} width={dim} height={dim} className={`object-cover object-top ${size === "fill" ? "h-full w-full" : "shrink-0 rounded-[14px]"} ${className}`} style={dim ? { width: dim, height: dim } : undefined} />
  );
}
