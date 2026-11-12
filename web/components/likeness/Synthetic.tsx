/** Labels for synthetic demo creators: a badge, a one-line note, and their (public) face. */
import { Initial, StatusPill } from "@/components/ds";
import { SYNTHETIC_DECIDER, SYNTHETIC_NOTE, syntheticOf } from "@/lib/synthetic";

export function SyntheticBadge({ accountId }: { accountId: string | null | undefined }) {
  if (!syntheticOf(accountId)) return null;
  return (
    <StatusPill kind="waiting" title={`${SYNTHETIC_NOTE}. ${SYNTHETIC_DECIDER}`}>
      Synthetic demo creator
    </StatusPill>
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

/** A creator's face where it may be public (synthetic only); everyone else gets their initial. */
export function CreatorAvatar({ accountId, size = 56, className = "" }: { accountId: string; size?: number | "fill"; className?: string }) {
  const s = syntheticOf(accountId);
  if (!s) return size === "fill" ? <span className={`flex h-full w-full items-center justify-center bg-paper ${className}`}><Initial name={accountId} size={72} /></span> : <Initial name={accountId} size={size} />;
  const dim = size === "fill" ? undefined : size;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={s.face} alt={`${s.name}: AI-generated face, not a real person`} width={dim} height={dim} className={`object-cover object-top ${size === "fill" ? "h-full w-full" : "shrink-0 rounded-[14px]"} ${className}`} style={dim ? { width: dim, height: dim } : undefined} />
  );
}
