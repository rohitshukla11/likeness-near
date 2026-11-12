"use client";

/**
 * What the brand asks its agent for: a brief, the use, how long and how many renders, and the two things the agent
 * may vary in the fixed prompt template (the scene and the product, each ≤ 200 characters). Banned uses are checked
 * here first, and again on the server before anything reaches a model or the chain.
 */
import { useState } from "react";
import { btnClass, Card, ErrorCard } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { Field, inputClass } from "@/components/ui";
import { api, NotConnectedError } from "@/lib/api";
import { BRIEF_MAX, FIELD_MAX, MAX_DAYS_LIMIT, textProblems, USE_LABELS, USES, type Use } from "@/lib/rules";
import type { CampaignRequest } from "@/lib/types";

export function CampaignForm({ onStarted }: { onStarted: () => void }) {
  const [brief, setBrief] = useState("");
  const [use, setUse] = useState<Use>("Fitness");
  const [durationDays, setDays] = useState(30);
  const [renderCap, setCap] = useState(3);
  const [scene, setScene] = useState("");
  const [product, setProduct] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const problems = [...textProblems(brief), ...textProblems(scene, "the scene", FIELD_MAX), ...textProblems(product, "the product", FIELD_MAX)];

  return (
    <Card title="Ask your agent for a campaign">
      <form
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (problems.length) return;
          setBusy(true);
          setError(null);
          try {
            const body: CampaignRequest = { brief, use, durationDays, renderCap, scene, product };
            await api("/api/agent/campaign", body);
            onStarted();
          } catch (err) {
            setError(err);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Brief" hint={`What the campaign is for, up to ${BRIEF_MAX} characters`}>
          <textarea className={`${inputClass} min-h-24`} value={brief} maxLength={BRIEF_MAX} onChange={(e) => setBrief(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Use">
            <select className={inputClass} value={use} onChange={(e) => setUse(e.target.value as Use)}>
              {USES.map((u) => (
                <option key={u} value={u}>
                  {USE_LABELS[u]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Licence length (days)">
            <input className={inputClass} type="number" min={1} max={MAX_DAYS_LIMIT} value={durationDays} onChange={(e) => setDays(Number(e.target.value))} />
          </Field>
          <Field label="Renders">
            <input className={inputClass} type="number" min={1} max={20} value={renderCap} onChange={(e) => setCap(Number(e.target.value))} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Scene" hint="e.g. a bright café counter in the morning">
            <input className={inputClass} value={scene} maxLength={FIELD_MAX} onChange={(e) => setScene(e.target.value)} />
          </Field>
          <Field label="Product" hint="e.g. a white ceramic coffee cup with no logo">
            <input className={inputClass} value={product} maxLength={FIELD_MAX} onChange={(e) => setProduct(e.target.value)} />
          </Field>
        </div>
        <p className="m-0 text-[13px] text-grey">
          The agent picks creators whose terms fit, asks each for a licence, and makes ads only under licences they approve. Each ad still waits for
          the creator&apos;s own approval before anything is paid.
        </p>
        {problems.length > 0 && (brief || scene || product) && (
          <ul className="m-0 pl-5 text-[14px] text-wait">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <button type="submit" disabled={busy || problems.length > 0} className={btnClass("lime", "self-start")}>
          {busy ? "Starting…" : "Start the agent"}
        </button>
        {error instanceof NotConnectedError ? <NotConnected what="The brand agent (/api/agent/campaign)" /> : error ? <ErrorCard>{(error as Error).message}</ErrorCard> : null}
      </form>
    </Card>
  );
}
