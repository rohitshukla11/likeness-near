/**
 * TEE attestation checks for a NEAR AI Cloud model, pure (node:crypto only; every input is passed in, so the tests run
 * on a real saved report with no network). What is checked, following NEAR AI's verifier
 * (near-examples/nearai-cloud-verification-example + nearai/nearai-cloud-verifier):
 *
 *   nonce     our fresh 32-byte nonce is echoed in the model attestation and the gateway attestation
 *   tdx       the Intel TDX quote is genuine: its ECDSA P-256 signature by the attestation key; the QE report signed by
 *             the PCK certificate; the QE report binding that attestation key; the PCK chain up to Intel's SGX Root
 *             CA, pinned by fingerprint and valid now. NOT checked: Intel's TCB status / revocation collateral.
 *   binding   the quote's report_data = the model's signing address (padded to 32 bytes) || our nonce
 *   gpu       NVIDIA's attestation service (NRAS) verdict: every JWT signed (ES384) by a key in NVIDIA's JWKS and not
 *             expired; overall result true; eat_nonce = our nonce; every GPU: measurements match, nonce matches,
 *             debug disabled; and the GPU evidence we sent carries our nonce
 *
 * `verified` is true only when every check passes; `failed` names each check that didn't.
 */
import { createHash, createPublicKey, verify as cverify, X509Certificate, type JsonWebKey } from "node:crypto";
export { teeLabel } from "./label.ts";

/** Intel SGX Root CA (https://certificates.trustedservices.intel.com/Intel_SGX_Provisioning_Certification_RootCA.cer). */
export const INTEL_SGX_ROOT_FP256 = "44:A0:19:6B:2B:99:F8:89:B8:E1:49:E9:5B:80:7A:35:0E:74:24:96:43:99:E8:85:A7:CB:B8:CC:FA:B6:74:D3";
export const NRAS_ISSUER = "https://nras.attestation.nvidia.com";
/** The start line of each certificate in the quote's PCK chain (public certificates, built here rather than written out). */
const CERT_START = `${"-".repeat(5)}BEGIN CERTIFICATE${"-".repeat(5)}`;

export interface TdxResult {
  quoteSigOk: boolean;
  qeReportSigOk: boolean;
  qeBindsKeyOk: boolean;
  chainOk: boolean;
  rootPinnedOk: boolean;
  certsValidNow: boolean;
  /** Bytes 0..64 of the TD report's report_data, hex. */
  reportData: string;
}

export interface GpuResult {
  payloadNonceOk: boolean;
  jwtSigsOk: boolean;
  notExpired: boolean;
  overall: boolean;
  eatNonceOk: boolean;
  gpus: number;
  gpusOk: boolean;
  hwmodel: string | null;
}

export interface TeeResult {
  model: string;
  verifiedAt: string;
  nonce: string;
  signingAddress: string | null;
  /** sha256 of the exact attestation report body NEAR AI returned. */
  reportSha256: string;
  nonceOk: boolean;
  tdxOk: boolean;
  bindingOk: boolean;
  gpuOk: boolean;
  verified: boolean;
  failed: string[];
  tdx: TdxResult | null;
  gpu: GpuResult | null;
  /** Always false here: Intel's TCB status isn't checked (said plainly wherever details are shown). */
  tcbStatusChecked: false;
  error?: string;
}

/** The summary stored with a render and shown in the UI (no raw report). */
export type TeeSummary = Pick<TeeResult, "model" | "verifiedAt" | "verified" | "failed" | "nonceOk" | "tdxOk" | "bindingOk" | "gpuOk" | "signingAddress" | "reportSha256">;
export const summarize = (r: TeeResult): TeeSummary => ({
  model: r.model,
  verifiedAt: r.verifiedAt,
  verified: r.verified,
  failed: r.failed,
  nonceOk: r.nonceOk,
  tdxOk: r.tdxOk,
  bindingOk: r.bindingOk,
  gpuOk: r.gpuOk,
  signingAddress: r.signingAddress,
  reportSha256: r.reportSha256,
});

const ecP256 = (raw64: Buffer) =>
  createPublicKey({ key: { kty: "EC", crv: "P-256", x: raw64.subarray(0, 32).toString("base64url"), y: raw64.subarray(32, 64).toString("base64url") }, format: "jwk" });

/** An Intel TDX v4 quote, verified up to Intel's root CA. Throws only on bytes that aren't a v4 TDX quote at all. */
export function verifyTdxQuote(quoteHex: string, now: Date): TdxResult {
  const q = Buffer.from(quoteHex, "hex");
  if (q.length < 1100 || q.readUInt16LE(0) !== 4 || q.readUInt32LE(4) !== 0x81) throw new Error("not a TDX v4 quote");
  const HEADER = 48;
  const BODY = 584;
  let o = HEADER + BODY + 4;
  const sig = q.subarray(o, o + 64);
  o += 64;
  const attKey = q.subarray(o, o + 64);
  o += 64;
  if (q.readUInt16LE(o) !== 6) throw new Error("quote certification data isn't a QE report (type 6)");
  o += 6;
  const qeReport = q.subarray(o, o + 384);
  o += 384;
  const qeSig = q.subarray(o, o + 64);
  o += 64;
  const authLen = q.readUInt16LE(o);
  o += 2;
  const qeAuth = q.subarray(o, o + authLen);
  o += authLen;
  if (q.readUInt16LE(o) !== 5) throw new Error("QE certification data isn't a PCK chain (type 5)");
  const pemLen = q.readUInt32LE(o + 2);
  o += 6;
  const pem = q.subarray(o, o + pemLen).toString("utf8");
  const reportData = q.subarray(HEADER + 520, HEADER + 584).toString("hex");

  const safe = (f: () => boolean) => {
    try {
      return f();
    } catch {
      return false;
    }
  };
  const quoteSigOk = safe(() => cverify("sha256", q.subarray(0, HEADER + BODY), { key: ecP256(attKey), dsaEncoding: "ieee-p1363" }, sig));
  const certs = pem
    .split(new RegExp(`(?=${CERT_START})`))
    .filter((s) => s.startsWith(CERT_START))
    .map((p) => new X509Certificate(p));
  const [leaf, inter, root] = certs;
  const qeReportSigOk = !!leaf && safe(() => cverify("sha256", qeReport, { key: leaf.publicKey, dsaEncoding: "ieee-p1363" }, qeSig));
  const qeBindsKeyOk = qeReport.subarray(320, 352).equals(createHash("sha256").update(attKey).update(qeAuth).digest());
  const chainOk = certs.length === 3 && safe(() => leaf!.verify(inter!.publicKey) && inter!.verify(root!.publicKey) && root!.verify(root!.publicKey));
  const rootPinnedOk = !!root && root.fingerprint256 === INTEL_SGX_ROOT_FP256;
  const certsValidNow = certs.length === 3 && certs.every((c) => new Date(c.validFrom) <= now && now <= new Date(c.validTo));
  return { quoteSigOk, qeReportSigOk, qeBindsKeyOk, chainOk, rootPinnedOk, certsValidNow, reportData };
}

/** report_data[0..32] = signing address right-padded to 32 bytes; report_data[32..64] = our raw nonce. */
export function reportDataBinds(reportDataHex: string, signingAddress: string, nonce: string): boolean {
  const addr = Buffer.from(signingAddress.replace(/^0x/i, ""), "hex");
  if (addr.length === 0 || addr.length > 32) return false;
  const want = Buffer.concat([addr, Buffer.alloc(32 - addr.length)]).toString("hex") + nonce.toLowerCase();
  return reportDataHex.toLowerCase() === want;
}

type Jwks = { keys: (JsonWebKey & { kid?: string })[] };

/** NVIDIA NRAS's answer ([["JWT", token], {"GPU-0": token, …}]) checked against its JWKS, our nonce and the clock. */
export function verifyNras(nras: unknown, jwks: Jwks, nonce: string, nowSec: number, payloadNonce: string | null): GpuResult {
  const tokens: [string, string][] = [];
  for (const item of Array.isArray(nras) ? nras : []) {
    if (Array.isArray(item) && item.length === 2 && typeof item[1] === "string") tokens.push([String(item[0]), item[1]]);
    else if (item && typeof item === "object") for (const [k, v] of Object.entries(item)) if (typeof v === "string") tokens.push([k, v]);
  }
  let jwtSigsOk = tokens.length > 0;
  let notExpired = tokens.length > 0;
  let overall = false;
  let eatNonceOk = false;
  let gpus = 0;
  let gpusOk = true;
  let hwmodel: string | null = null;
  for (const [name, jwt] of tokens) {
    const [h, p, s] = jwt.split(".");
    let claims: Record<string, unknown> = {};
    try {
      const header = JSON.parse(Buffer.from(h!, "base64url").toString()) as { kid?: string; alg?: string };
      claims = JSON.parse(Buffer.from(p!, "base64url").toString()) as Record<string, unknown>;
      const jwk = jwks.keys.find((k) => k.kid === header.kid);
      const ok =
        header.alg === "ES384" && !!jwk && claims.iss === NRAS_ISSUER &&
        cverify("sha384", Buffer.from(`${h}.${p}`), { key: createPublicKey({ key: jwk, format: "jwk" }), dsaEncoding: "ieee-p1363" }, Buffer.from(s!, "base64url"));
      jwtSigsOk &&= ok;
      notExpired &&= typeof claims.exp === "number" && claims.exp > nowSec;
    } catch {
      jwtSigsOk = false;
    }
    if (name === "JWT") {
      overall = claims["x-nvidia-overall-att-result"] === true;
      eatNonceOk = String(claims.eat_nonce ?? "").toLowerCase() === nonce.toLowerCase();
    } else if (name.startsWith("GPU-")) {
      gpus++;
      hwmodel ??= (claims.hwmodel as string) ?? null;
      gpusOk &&= claims.measres === "success" && claims["x-nvidia-gpu-attestation-report-nonce-match"] === true && claims.dbgstat === "disabled";
    }
  }
  return { payloadNonceOk: (payloadNonce ?? "").toLowerCase() === nonce.toLowerCase(), jwtSigsOk, notExpired, overall, eatNonceOk, gpus, gpusOk: gpus > 0 && gpusOk, hwmodel };
}

interface ReportShape {
  gateway_attestation?: { request_nonce?: string };
  model_attestations?: { model_name?: string; signing_address?: string; request_nonce?: string; intel_quote?: string; nvidia_payload?: string }[];
}

/** All checks on one report, given NRAS's answer and NVIDIA's keys. `now` is injected (tests use the fetch time). */
export function verifyAttestation(i: { model: string; nonce: string; reportText: string; nras: unknown; jwks: Jwks; now: Date }): TeeResult {
  const base = {
    model: i.model,
    verifiedAt: i.now.toISOString(),
    nonce: i.nonce,
    reportSha256: createHash("sha256").update(i.reportText).digest("hex"),
    tcbStatusChecked: false as const,
  };
  let report: ReportShape;
  try {
    report = JSON.parse(i.reportText) as ReportShape;
  } catch {
    return { ...base, signingAddress: null, nonceOk: false, tdxOk: false, bindingOk: false, gpuOk: false, verified: false, failed: ["report"], tdx: null, gpu: null, error: "the report isn't JSON" };
  }
  const a = (report.model_attestations ?? []).find((x) => x.model_name === i.model) ?? report.model_attestations?.[0];
  if (!a?.intel_quote || !a.signing_address) {
    return { ...base, signingAddress: null, nonceOk: false, tdxOk: false, bindingOk: false, gpuOk: false, verified: false, failed: ["report"], tdx: null, gpu: null, error: "no model attestation in the report" };
  }
  const nonceOk = a.request_nonce === i.nonce && report.gateway_attestation?.request_nonce === i.nonce && a.model_name === i.model;
  let tdx: TdxResult | null = null;
  let error: string | undefined;
  try {
    tdx = verifyTdxQuote(a.intel_quote, i.now);
  } catch (e) {
    error = (e as Error).message;
  }
  const tdxOk = !!tdx && tdx.quoteSigOk && tdx.qeReportSigOk && tdx.qeBindsKeyOk && tdx.chainOk && tdx.rootPinnedOk && tdx.certsValidNow;
  const bindingOk = !!tdx && reportDataBinds(tdx.reportData, a.signing_address, i.nonce);
  let payloadNonce: string | null = null;
  try {
    payloadNonce = (JSON.parse(a.nvidia_payload ?? "{}") as { nonce?: string }).nonce ?? null;
  } catch {
    payloadNonce = null;
  }
  const gpu = verifyNras(i.nras, i.jwks, i.nonce, i.now.getTime() / 1000, payloadNonce);
  const gpuOk = gpu.payloadNonceOk && gpu.jwtSigsOk && gpu.notExpired && gpu.overall && gpu.eatNonceOk && gpu.gpusOk;
  const failed = [!nonceOk && "nonce", !tdxOk && "tdx", !bindingOk && "binding", !gpuOk && "gpu"].filter((x): x is string => !!x);
  return { ...base, signingAddress: a.signing_address, nonceOk, tdxOk, bindingOk, gpuOk, verified: failed.length === 0, failed, tdx, gpu, ...(error ? { error } : {}) };
}

/** TEE_ATTESTATION_ENABLED: on unless set to "false" (then no attestation call is made and nothing is recorded). */
export const teeEnabled = (env: Record<string, string | undefined> = process.env) => env.TEE_ATTESTATION_ENABLED !== "false";

/** What the ad flow records: null when attestation is off (and `run` is never called), else the summary. */
export async function recordTee(enabled: boolean, run: () => Promise<TeeResult>): Promise<TeeSummary | null> {
  if (!enabled) return null;
  return summarize(await run());
}

/** The hard limit on one attestation check (report + NVIDIA + keys), so an ad is never delayed beyond it. */
export const TEE_TIMEOUT_MS = 20_000;

/** The check, or a "not verified (timed out)" result after `ms`; never rejects (any error becomes not verified). */
export async function withTimeout<T>(work: Promise<T>, ms: number, onFail: (reason: string) => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<T>((res) => {
    timer = setTimeout(() => res(onFail(`timed out after ${Math.round(ms / 1000)} s`)), ms);
  });
  try {
    return await Promise.race([work.catch((e: unknown) => onFail((e as Error)?.message ?? "error")), late]);
  } finally {
    clearTimeout(timer);
  }
}

/** The not-verified result for a check that couldn't run (an error or the timeout). */
export function failedResult(model: string, nonce: string, reason: string, now = new Date()): TeeResult {
  return {
    model,
    verifiedAt: now.toISOString(),
    nonce,
    signingAddress: null,
    reportSha256: "",
    nonceOk: false,
    tdxOk: false,
    bindingOk: false,
    gpuOk: false,
    verified: false,
    failed: ["report"],
    tdx: null,
    gpu: null,
    tcbStatusChecked: false,
    error: reason.slice(0, 200),
  };
}

/**
 * A per-model cache of verified results (10 minutes by default): a verified result is reused until it's that old, then
 * a fresh nonce is used. A failed result is never cached (the next call tries again).
 */
export function attestCache<T extends { verified: boolean }>(run: (model: string) => Promise<T>, ttlMs = 10 * 60_000, now = () => Date.now()) {
  const hits = new Map<string, { at: number; value: T }>();
  const inflight = new Map<string, Promise<T>>();
  return async (model: string): Promise<T> => {
    const h = hits.get(model);
    if (h && now() - h.at < ttlMs) return h.value;
    // Simultaneous callers share one check (a burst of visitors can't fan out to NEAR AI and NVIDIA).
    const pending = inflight.get(model);
    if (pending) return pending;
    const p = run(model)
      .then((value) => {
        if (value.verified) hits.set(model, { at: now(), value });
        else hits.delete(model);
        return value;
      })
      .finally(() => inflight.delete(model));
    inflight.set(model, p);
    return p;
  };
}
