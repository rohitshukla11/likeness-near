"use client";

/**
 * Verify: drop a file (hashed in the browser, never uploaded) or paste its sha256, and read the answer straight from
 * the contract (verify(sha256)): Licensed, Expired, Revoked or Unknown. No wallet, no sign-in, no Likeness server.
 */
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppPage, btnClass, Card, ErrorCard, Skeleton } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { inputClass } from "@/components/ui";
import { Verdict } from "@/components/likeness/Verdict";
import { sha256Hex } from "@/lib/api";
import { contractConfigured, DEMO_RECEIPT_SHA } from "@/lib/near/config";
import { views } from "@/lib/near/view";
import type { VerifyResult } from "@/lib/types";

const HEX64 = /^[0-9a-f]{64}$/;

function VerifyInner() {
  const params = useSearchParams();
  const initial = (params.get("sha256") ?? "").toLowerCase().replace(/^0x/, "");
  const [sha, setSha] = useState(initial);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check(h: string) {
    setError(null);
    setResult(null);
    if (!HEX64.test(h)) return setError("A sha256 is 64 hex characters.");
    setBusy(true);
    try {
      setResult(await views.verify(h));
    } catch (e) {
      setError(`The contract couldn't be read: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!HEX64.test(initial) || !contractConfigured()) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await views.verify(initial);
        if (!cancelled) setResult(r);
      } catch (e) {
        if (!cancelled) setError(`The contract couldn't be read: ${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial]);

  return (
    <div className="flex flex-col gap-[18px]">
      {!contractConfigured() && <NotConnected what="The Likeness contract" />}
      <Card title="Check a file">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[16px] border-2 border-dashed border-field p-6 text-center text-[15px]">
          <span className="font-semibold">Choose or drop an image or video</span>
          <span className="text-[13px] text-grey">It&apos;s hashed here in your browser and never uploaded.</span>
          <input
            type="file"
            accept="image/*,video/mp4"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const h = await sha256Hex(f);
              setSha(h);
              void check(h);
            }}
          />
        </label>
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void check(sha.trim().toLowerCase().replace(/^0x/, ""));
          }}
        >
          <input className={`${inputClass} min-w-0 flex-1 font-mono text-[13px]`} placeholder="or paste a sha256" value={sha} onChange={(e) => setSha(e.target.value)} aria-label="sha256" />
          <button type="submit" disabled={busy || !contractConfigured()} className={btnClass("ink")}>
            {busy ? "Checking…" : "Verify"}
          </button>
        </form>
      </Card>
      {error && <ErrorCard>{error}</ErrorCard>}
      {result && <Verdict r={result} />}
      <p className="m-0 text-[14px]">
        <Link href={`/verify?sha256=${DEMO_RECEIPT_SHA}`} className="font-semibold underline">
          Try with a real receipt
        </Link>{" "}
        <span className="text-grey">: an ad from our live run, approved and paid on testnet, then its licence was revoked.</span>
      </p>
      <p className="m-0 text-[13px] text-grey">
        Prefer not to trust this page? The standalone verifier at <a href="/verifier/index.html">/verifier/index.html</a> talks only to the NEAR RPC.
      </p>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <AppPage title="Verify an ad" description="Is this exact file licensed by the person in it? The answer comes from the NEAR contract.">
      <Suspense fallback={<Skeleton className="h-40" />}>
        <VerifyInner />
      </Suspense>
    </AppPage>
  );
}
