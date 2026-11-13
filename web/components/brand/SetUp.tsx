"use client";

/**
 * "Set up once", compact: a dark panel with "N of 3" and a thin 3-segment bar over three small cards in a row
 * (1 · Escrow, 2 · Limits, 3 · Agent key; they wrap on phones), always open, even when all three are done. Every number
 * is the contract's.
 */
import { useState, type ReactNode } from "react";
import { ContractNotConfigured } from "@/lib/near/wallet";
import { txUrl } from "@/lib/near/config";
import type { TxState } from "@/components/likeness/TxLine";

export function SetUpPanel({ done, children }: { done: [boolean, boolean, boolean]; children: ReactNode }) {
  const n = done.filter(Boolean).length;
  return (
    <section id="setup" className="flex min-w-0 scroll-mt-4 flex-col gap-3 rounded-[22px] bg-ink p-4 text-white sm:p-5" aria-label="Set up once">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-[18px] font-bold text-white">Set up once</h2>
        <span className="flex items-center gap-2 text-[12px] font-semibold text-grey-dark" aria-label={`${n} of 3 done`}>
          {n} of 3
          <span className="flex gap-1" aria-hidden="true">
            {done.map((d, i) => (
              <span key={i} className={`h-1 w-8 rounded-full ${d ? "bg-lime" : "bg-white/20"}`} />
            ))}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-1 items-stretch gap-3 md:grid-cols-3">{children}</div>
    </section>
  );
}

export function SetUpCard({ n, title, pill, children }: { n: number; title: string; pill: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-[16px] bg-white p-4 text-ink" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-[16px] font-bold">
          {n} · {title}
        </h3>
        {pill}
      </div>
      {children}
    </section>
  );
}

/** Done (green) or still to do (amber). */
export function SetPill({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${ok ? "bg-ok-bg text-ok" : "bg-[#FFF1D6] text-[#7A4B00]"}`}>{ok ? yes : no}</span>;
}

const walletClosed = (e: unknown) => /reject|cancel|closed|denied|abort|user/i.test((e as Error)?.message ?? String(e));

/** One line under a card: waiting, done (with the transaction), or why nothing happened. */
export function TxNote({ s }: { s: TxState }) {
  if (s.kind === "idle") return null;
  if (s.kind === "busy") return <p className="m-0 text-[13px] text-grey">Waiting for your wallet…</p>;
  if (s.kind === "done")
    return (
      <p className="m-0 text-[13px] text-ok">
        Done.{" "}
        {s.hash && (
          <a href={txUrl(s.hash)} target="_blank" rel="noreferrer" className="underline">
            Transaction ↗
          </a>
        )}
      </p>
    );
  const msg =
    s.error instanceof ContractNotConfigured
      ? "The contract isn't configured in this build."
      : walletClosed(s.error)
        ? "Wallet closed before approval. Nothing sent, try again."
        : ((s.error as Error)?.message ?? String(s.error)).slice(0, 160);
  return (
    <p role="alert" className="m-0 text-[13px] text-bad">
      {msg}
    </p>
  );
}

/** "ed25519:Eo6UMm…BgmxF8rj" */
export const shortKey = (k: string) => (k.length > 30 ? `${k.slice(0, 14)}…${k.slice(-8)}` : k);

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard blocked: nothing to do
        }
      }}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-field text-ink hover:border-ink"
    >
      {copied ? (
        "✓"
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  );
}
