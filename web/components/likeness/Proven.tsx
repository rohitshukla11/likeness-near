"use client";

/**
 * "Likeness proven" / "Likeness not proven": whether a creator has recorded a consented camera capture on the contract
 * (its sha256, from registration or set_capture). Unproven creators can register terms and receive licence requests,
 * but no ad can be made with their face until they prove it, and brands see the label. `ProveCard` is the creator's
 * own "Prove your likeness" panel: what proving adds, then the capture flow (consent → camera → save → set_capture).
 */
import { useState } from "react";
import { btnClass } from "@/components/ds";
import { CHIP, MUTED, SURFACE } from "./Dash";
import { ProveLikeness } from "./ProveLikeness";

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

const ADDS = [
  ["Brands' agents can make ads with your face.", "Every ad is an edit of the reference photo you consent to here; without one, no ad can be made."],
  ["A “Likeness proven” badge.", "Brands see it next to your name instead of “Likeness not proven”."],
  ["Every ad is checked against you.", "An advisory AI similarity check compares each ad with your reference before it reaches you; you still approve every ad."],
  ["Only a fingerprint goes on-chain.", "One transaction (set_capture) records the photo's sha256 on NEAR. The photo stays private and is never shown publicly."],
] as const;

export function ProveCard({ onProven }: { onProven: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`${SURFACE} flex flex-col gap-4 p-5 sm:p-6`} aria-label="Prove your likeness">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[20px] font-bold">Prove your likeness</h2>
        <LikenessChip proven={false} />
      </div>
      <p className={`m-0 text-[15px] ${MUTED}`}>
        Your terms are live and brands can ask you for a licence. Proving your likeness takes about a minute with your camera, and it adds:
      </p>
      <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
        {ADDS.map(([title, body]) => (
          <li key={title} className="flex flex-col gap-0.5 rounded-[16px] bg-paper p-3 text-[14px]">
            <b>{title}</b>
            <span className={MUTED}>{body}</span>
          </li>
        ))}
      </ul>
      {open ? (
        <ProveLikeness registered onProven={() => onProven()} />
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={btnClass("lime", "self-start")}>
          Prove your likeness
        </button>
      )}
    </section>
  );
}
