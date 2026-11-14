/**
 * Live TEE attestation for a NEAR AI Cloud model (checks in ./verify.ts): a fresh 32-byte nonce, NEAR AI's
 * GET /v1/attestation/report (no inference, nothing billed), NVIDIA NRAS for the GPU evidence, NVIDIA's JWKS (cached
 * an hour). A verified result is reused for 10 minutes per model, then re-verified with a new nonce. Never throws: a
 * network error or a failed check is a result with verified=false and the failing check named. The raw report of the
 * latest attempt per model is kept in memory for /trust (it's public data; the API key is only ever in a header).
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { BASE } from "../ai/nearai";
import { attestCache, failedResult, recordTee, TEE_TIMEOUT_MS, teeEnabled, verifyAttestation, withTimeout, type TeeResult, type TeeSummary } from "./verify";

const NRAS = "https://nras.attestation.nvidia.com/v3/attest/gpu";
const JWKS = "https://nras.attestation.nvidia.com/.well-known/jwks.json";

let jwksCache: { at: number; keys: { keys: object[] } } | null = null;
async function nvidiaKeys() {
  if (jwksCache && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const r = await fetch(JWKS, { signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`NVIDIA JWKS HTTP ${r.status}`);
  jwksCache = { at: Date.now(), keys: (await r.json()) as { keys: object[] } };
  return jwksCache.keys;
}

/** The latest attempt per model (verified or not), with its raw report text, for /trust. */
const latest = new Map<string, { result: TeeResult; reportText: string | null }>();
export const latestAttestation = (model: string) => latest.get(model) ?? null;

async function attestNow(model: string): Promise<TeeResult> {
  const nonce = randomBytes(32).toString("hex");
  const now = new Date();
  let reportText: string | null = null;
  try {
    const key = process.env.NEARAI_API_KEY;
    if (!key) throw new Error("NEARAI_API_KEY is not set");
    const r = await fetch(`${BASE}/attestation/report?model=${encodeURIComponent(model)}&signing_algo=ecdsa&nonce=${nonce}`, {
      headers: { accept: "application/json", authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) throw new Error(`attestation report HTTP ${r.status}`);
    reportText = await r.text();
    const payload = (JSON.parse(reportText) as { model_attestations?: { model_name?: string; nvidia_payload?: string }[] }).model_attestations?.find((a) => a.model_name === model)?.nvidia_payload;
    if (!payload) throw new Error("no GPU evidence in the report");
    const [nras, jwks] = await Promise.all([
      fetch(NRAS, { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: payload, signal: AbortSignal.timeout(15_000) }).then(async (x) => {
        if (!x.ok) throw new Error(`NVIDIA NRAS HTTP ${x.status}`);
        return x.json();
      }),
      nvidiaKeys(),
    ]);
    const result = verifyAttestation({ model, nonce, reportText, nras, jwks: jwks as never, now });
    latest.set(model, { result, reportText });
    return result;
  } catch (e) {
    const result = failedResult(model, nonce, (e as Error).message, now);
    latest.set(model, { result, reportText });
    return result;
  }
}

/** One check with the hard timeout: a hung NEAR AI or NVIDIA endpoint gives "not verified" after TEE_TIMEOUT_MS. */
function attestBounded(model: string): Promise<TeeResult> {
  return withTimeout(attestNow(model), TEE_TIMEOUT_MS, (reason) => {
    const result = failedResult(model, "", reason);
    latest.set(model, { result, reportText: null });
    return result;
  });
}

/** A current attestation for the model: reused for 10 minutes once verified; never throws; at most TEE_TIMEOUT_MS. */
export const attest = attestCache(attestBounded);

/** For the ad flow: the summary to record, or null when TEE_ATTESTATION_ENABLED=false (nothing is called). */
export function attestForRender(model: string): Promise<TeeSummary | null> {
  return recordTee(teeEnabled(), () => attest(model));
}
