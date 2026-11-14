/**
 * GET /api/tee/status: the current TEE attestation of each NEAR AI model this app sends faces to (FLUX.2-klein for
 * images, Qwen for the agent and the safety screen), verified now or reused if verified in the last 10 minutes. Public;
 * the checks and their results, never the API key. GET ?model=<id>&raw=1 downloads that model's raw report.
 * No database: no rate-limit row is written; the 10-minute cache bounds the calls to NEAR AI and NVIDIA.
 */
import { HttpError, json, route } from "@/lib/http";
import { CHAT_MODEL, IMAGE_MODEL } from "@/lib/ai/nearai";
import { attest, latestAttestation } from "@/lib/tee/attestation";
import { teeEnabled } from "@/lib/tee/verify";

const MODELS = [IMAGE_MODEL, CHAT_MODEL];

export const GET = route(async (req: Request) => {
  if (!teeEnabled()) return json({ enabled: false, models: [] });
  const u = new URL(req.url);
  const model = u.searchParams.get("model");
  if (u.searchParams.get("raw") === "1") {
    if (!model || !MODELS.includes(model)) throw new HttpError(400, "model must be one this app uses");
    const l = latestAttestation(model) ?? (await attest(model), latestAttestation(model));
    if (!l?.reportText) throw new HttpError(404, "no report for this model yet");
    return new Response(l.reportText, {
      headers: { "content-type": "application/json", "content-disposition": `attachment; filename="nearai-attestation-${model.split("/").pop()}-${l.result.verifiedAt}.json"`, "cache-control": "no-store" },
    });
  }
  const results = await Promise.all(MODELS.map((m) => attest(m)));
  return json({
    enabled: true,
    models: results.map((r) => ({
      model: r.model,
      role: r.model === IMAGE_MODEL ? "Ad images (edits of the creator's photo)" : "The agent and the safety screen",
      verified: r.verified,
      verifiedAt: r.verifiedAt,
      failed: r.failed,
      error: r.error ?? null,
      nonce: r.nonce,
      signingAddress: r.signingAddress,
      reportSha256: r.reportSha256,
      checks: {
        nonce: r.nonceOk,
        tdx: r.tdx ? { ok: r.tdxOk, quoteSignature: r.tdx.quoteSigOk, qeReport: r.tdx.qeReportSigOk, qeBindsKey: r.tdx.qeBindsKeyOk, chainToIntelRoot: r.tdx.chainOk && r.tdx.rootPinnedOk, certsValidNow: r.tdx.certsValidNow } : null,
        binding: r.bindingOk,
        gpu: r.gpu ? { ok: r.gpuOk, overall: r.gpu.overall, nonce: r.gpu.eatNonceOk && r.gpu.payloadNonceOk, tokensSigned: r.gpu.jwtSigsOk, notExpired: r.gpu.notExpired, gpus: r.gpu.gpus, gpusOk: r.gpu.gpusOk, hwmodel: r.gpu.hwmodel } : null,
        tcbStatusChecked: false,
      },
    })),
  });
});
