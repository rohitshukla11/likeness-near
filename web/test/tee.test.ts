// node --test: TEE attestation checks on a REAL NEAR AI report for FLUX.2-klein, NVIDIA NRAS's real answer and
// NVIDIA's JWKS, all saved once (test/fixtures/tee/flux-attestation.json; public data, no keys). No network here.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { attestCache, failedResult, recordTee, reportDataBinds, teeEnabled, teeLabel, verifyAttestation, verifyTdxQuote, withTimeout, summarize, INTEL_SGX_ROOT_FP256 } from "../lib/tee/verify.ts";
import { hasTeeRecord } from "../lib/tee/label.ts";

const fx = JSON.parse(readFileSync(new URL("./fixtures/tee/flux-attestation.json", import.meta.url), "utf8")) as {
  model: string;
  nonce: string;
  fetchedAt: string;
  report: { model_attestations: { intel_quote: string; signing_address: string; nvidia_payload: string; request_nonce: string }[]; gateway_attestation: { request_nonce: string } };
  nras: unknown;
  jwks: { keys: object[] };
};
const now = new Date(new Date(fx.fetchedAt).getTime() + 30_000);
const reportText = JSON.stringify(fx.report);
const run = (o: Partial<{ nonce: string; reportText: string; nras: unknown; now: Date }> = {}) =>
  verifyAttestation({ model: fx.model, nonce: o.nonce ?? fx.nonce, reportText: o.reportText ?? reportText, nras: o.nras ?? fx.nras, jwks: fx.jwks as never, now: o.now ?? now });

test("a real FLUX.2-klein attestation passes every check: fresh nonce, Intel TDX quote, key binding, NVIDIA GPUs", () => {
  const r = run();
  assert.deepEqual(r.failed, []);
  assert.equal(r.verified, true);
  assert.ok(r.tdx && r.tdx.quoteSigOk && r.tdx.qeReportSigOk && r.tdx.qeBindsKeyOk && r.tdx.chainOk && r.tdx.rootPinnedOk && r.tdx.certsValidNow);
  assert.ok(r.gpu && r.gpu.overall && r.gpu.eatNonceOk && r.gpu.jwtSigsOk && r.gpu.gpusOk && r.gpu.gpus >= 1);
  assert.equal(r.tcbStatusChecked, false, "Intel TCB status is not claimed");
  assert.equal(teeLabel(summarize(r)).text, "TEE attestation: verified");
});

test("a different nonce fails (replay): nonce, report_data binding and NVIDIA's eat_nonce all catch it", () => {
  const r = run({ nonce: "00".repeat(32) });
  assert.equal(r.verified, false);
  for (const f of ["nonce", "binding", "gpu"]) assert.ok(r.failed.includes(f), `fails ${f}`);
  assert.equal(teeLabel(summarize(r)).verified, false);
});

test("a tampered TDX quote fails (one byte of the TD report body flipped)", () => {
  const a = fx.report.model_attestations[0]!;
  const q = Buffer.from(a.intel_quote, "hex");
  q[200] ^= 0xff;
  const tampered = { ...fx.report, model_attestations: [{ ...a, intel_quote: q.toString("hex") }] };
  const r = run({ reportText: JSON.stringify(tampered) });
  assert.equal(r.verified, false);
  assert.ok(r.failed.includes("tdx"));
  assert.equal(r.tdx?.quoteSigOk, false);
});

test("the report_data binding is exactly signing address (32-byte padded) || nonce", () => {
  const a = fx.report.model_attestations[0]!;
  const rd = verifyTdxQuote(a.intel_quote, now).reportData;
  assert.ok(reportDataBinds(rd, a.signing_address, fx.nonce));
  assert.ok(!reportDataBinds(rd, "0x" + "11".repeat(20), fx.nonce));
});

test("NVIDIA's tokens expire: the same answer an hour later no longer verifies", () => {
  const r = run({ now: new Date(now.getTime() + 2 * 3600_000) });
  assert.equal(r.verified, false);
  assert.ok(r.failed.includes("gpu"));
  assert.equal(r.gpu?.notExpired, false);
});

test("a forged NVIDIA token fails its signature check", () => {
  const nras = JSON.parse(JSON.stringify(fx.nras)) as [string, string][];
  const [h, p, s] = nras[0]![1].split(".");
  const claims = JSON.parse(Buffer.from(p!, "base64url").toString());
  claims["x-nvidia-overall-att-result"] = true;
  claims.eat_nonce = "ff".repeat(32);
  nras[0]![1] = [h, Buffer.from(JSON.stringify(claims)).toString("base64url"), s].join(".");
  const r = run({ nras });
  assert.equal(r.gpu?.jwtSigsOk, false);
  assert.equal(r.verified, false);
});

test("the cache reuses a verified result for 10 minutes, then verifies again; failures are never cached", async () => {
  let t = 0;
  let calls = 0;
  const get = attestCache(async () => ({ verified: ++calls !== 3 }), 10 * 60_000, () => t);
  await get("m");
  t = 9 * 60_000;
  await get("m");
  assert.equal(calls, 1, "reused within 10 minutes");
  t = 10 * 60_000 + 1;
  await get("m");
  assert.equal(calls, 2, "verified again after 10 minutes");
  t += 11 * 60_000;
  const failed = await get("m");
  assert.equal(failed.verified, false);
  await get("m");
  assert.equal(calls, 4, "a failure is retried on the next call");
});

test("simultaneous callers share one check", async () => {
  let calls = 0;
  const get = attestCache(async () => (calls++, await new Promise((r) => setTimeout(r, 20)), { verified: true }));
  await Promise.all([get("m"), get("m"), get("m")]);
  assert.equal(calls, 1);
});

test("the UI never says verified unless every check passed", () => {
  const ok = summarize(run());
  for (const k of ["nonceOk", "tdxOk", "bindingOk", "gpuOk"] as const) {
    const bad = { ...ok, [k]: false };
    assert.equal(teeLabel(bad).verified, false, `${k} false`);
    assert.ok(!/: verified$/.test(teeLabel(bad).text));
  }
  assert.equal(teeLabel({ ...ok, verified: false, failed: ["gpu"], gpuOk: false }).text, "TEE attestation: not verified (NVIDIA GPU)");
  assert.equal(teeLabel(null).text, "TEE attestation: not recorded");
  assert.equal(INTEL_SGX_ROOT_FP256.length, 95);
});

test("TEE_ATTESTATION_ENABLED: on by default; \"false\" turns every call off and records nothing", async () => {
  assert.equal(teeEnabled({}), true);
  assert.equal(teeEnabled({ TEE_ATTESTATION_ENABLED: "true" }), true);
  assert.equal(teeEnabled({ TEE_ATTESTATION_ENABLED: "false" }), false);
  let calls = 0;
  const run = async () => (calls++, run1());
  const run1 = () => verifyAttestation({ model: fx.model, nonce: fx.nonce, reportText, nras: fx.nras, jwks: fx.jwks as never, now });
  assert.equal(await recordTee(false, run), null);
  assert.equal(calls, 0, "off: no attestation call at all");
  assert.equal(hasTeeRecord({ image: null, screen: null }), false, "off: the UI shows nothing TEE-related");
  const on = await recordTee(true, run);
  assert.equal(calls, 1);
  assert.equal(on?.verified, true);
  assert.equal(hasTeeRecord({ image: on, screen: null }), true);
});

test("a hung attestation endpoint gives \"not verified\" at the timeout, and the ad flow goes on", async () => {
  const hung = new Promise<never>(() => undefined);
  const t0 = Date.now();
  const r = await withTimeout(hung, 50, (reason) => failedResult("m", "", reason));
  assert.ok(Date.now() - t0 < 1000, "returns at the timeout");
  assert.equal(r.verified, false);
  assert.match(r.error ?? "", /timed out/);
  assert.equal(teeLabel(summarize(r)).verified, false);
  // An error is caught the same way (never thrown into the ad flow).
  const err = await withTimeout(Promise.reject(new Error("HTTP 502")), 1000, (reason) => failedResult("m", "", reason));
  assert.equal(err.verified, false);
  assert.match(err.error ?? "", /502/);
  // In the cache: a timeout isn't kept, so the next ad tries again.
  let calls = 0;
  const get = attestCache((m) => (calls++, withTimeout(new Promise<never>(() => undefined), 20, (reason) => failedResult(m, "", reason))));
  assert.equal((await get("m")).verified, false);
  await get("m");
  assert.equal(calls, 2);
  // And what the ad records then is a not-verified summary, not an exception.
  const rec = await recordTee(true, () => withTimeout(new Promise<never>(() => undefined), 20, (reason) => failedResult("m", "", reason)));
  assert.equal(rec?.verified, false);
});
