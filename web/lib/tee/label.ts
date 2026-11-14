/**
 * The words the UI uses for a TEE attestation summary, safe for the browser (no node imports). "verified" only when
 * every check passed; otherwise "not verified" naming the failed checks, or "not recorded" when there's none.
 */
export interface TeeChecks {
  verified: boolean;
  failed: string[];
  nonceOk: boolean;
  tdxOk: boolean;
  bindingOk: boolean;
  gpuOk: boolean;
}

export const TEE_CHECK_NAMES: Record<string, string> = { nonce: "fresh nonce", tdx: "Intel TDX quote", binding: "signing key binding", gpu: "NVIDIA GPU", report: "report" };

export function teeLabel(s: TeeChecks | null | undefined): { verified: boolean; text: string } {
  const allOk = !!s && s.verified === true && s.failed.length === 0 && s.nonceOk && s.tdxOk && s.bindingOk && s.gpuOk;
  if (allOk) return { verified: true, text: "TEE attestation: verified" };
  if (!s) return { verified: false, text: "TEE attestation: not recorded" };
  return { verified: false, text: `TEE attestation: not verified (${s.failed.map((f) => TEE_CHECK_NAMES[f] ?? f).join(", ") || "incomplete"})` };
}

/** Anything TEE-related to show for an ad: false for an ad made with attestation off (or before it existed). */
export const hasTeeRecord = (t: { image: unknown; screen: unknown } | null | undefined) => !!t && (!!t.image || !!t.screen);

/** "FLUX.2-klein-4B" from "black-forest-labs/FLUX.2-klein-4B". */
export const shortModel = (m: string) => m.split("/").pop() ?? m;
