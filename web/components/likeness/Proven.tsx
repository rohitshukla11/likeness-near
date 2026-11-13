/**
 * "Likeness proven" / "Likeness not proven": whether a creator's reference photo is recorded on the contract (its
 * sha256, from register_creator or set_capture). A creator registered without one can still receive licence requests,
 * but no ad can be made with their face until it's recorded, and brands see the label.
 */
import { CHIP } from "./Dash";

export const NOT_PROVEN_NOTE = "This creator hasn't proven their likeness yet: a licence can be approved, but no ad can be made until they do.";

export function LikenessChip({ proven, captureSha }: { proven: boolean; captureSha?: string | null }) {
  return proven ? (
    <span className={`${CHIP} bg-ok-bg text-ink`} title={captureSha ? `Capture sha256 ${captureSha}, recorded on NEAR` : "A consented capture is recorded on NEAR"}>
      ✓ Likeness proven
    </span>
  ) : (
    <span className={`${CHIP} bg-black/5 text-ink`} title={NOT_PROVEN_NOTE}>
      Likeness not proven
    </span>
  );
}
