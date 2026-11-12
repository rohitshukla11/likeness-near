/**
 * Honest labelling for demos where one NEAR account plays both roles: a licence (or ad) whose creator and brand are the
 * same account is a self-licence. It's allowed, and the consent rules don't change: the creator still approves every
 * licence and every ad from their own wallet, and the agent's key can't approve anything.
 */
import { StatusPill } from "@/components/ds";

export const isSelfLicence = (l: { creator: string; brand: string }) => l.creator === l.brand;

export const SELF_LICENCE_NOTE =
  "Self-licence (demo): the creator and the brand are the same account. Payment moves from this account's escrow back to itself.";

export function SelfLicenceBadge({ l }: { l: { creator: string; brand: string } }) {
  if (!isSelfLicence(l)) return null;
  return (
    <StatusPill kind="neutral" title={SELF_LICENCE_NOTE}>
      Self-licence (demo)
    </StatusPill>
  );
}
