"use client";

/**
 * The brand's agent, start to finish:
 *   1. the brief (description, use, licence days, renders; scene and product optional), prefilled with a café example
 *      the brand can edit → "Find creators";
 *   2. the banned-use screen runs first: a refusal shows its reason and stops;
 *   3. the agent's shortlist: the top 3 (name, price, price × renders = total, fits your budget or not, one-line
 *      reason) and below, every creator who wasn't eligible with the reason;
 *   4. the brand picks a card ("Request licence") or "Let the agent choose" (#1); over-budget cards are disabled.
 *      The agent's function-call key sends request_licence: "Waiting for <creator>";
 *   5. once the creator approves, the agent makes each render (writing the scene and product first if empty, then
 *      the image edit, the safety screen and the submission), with every step in the console.
 * Nothing is paid until the creator approves each ad in their own wallet.
 */
import { useEffect, useRef, useState } from "react";
import { btnClass, ErrorCard, Initial, StatusPill } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { inputClass } from "@/components/ui";
import { CHIP, MUTED, SURFACE } from "@/components/likeness/Dash";
import { SyntheticBadge } from "@/components/likeness/Synthetic";
import { api, NotConnectedError } from "@/lib/api";
import { accountUrl, txUrl } from "@/lib/near/config";
import { views } from "@/lib/near/view";
import { profileOf } from "@/lib/profiles";
import { BRIEF_MAX, FIELD_MAX, formatNear, MAX_DAYS_LIMIT, textProblems, USE_LABELS, USES, type Use } from "@/lib/rules";
import type { CampaignRequest, FindResponse, LicenceStatus, RequestResponse, ShortlistCard, VideoStatus } from "@/lib/types";
import { DEMO_BANNER } from "@/lib/agent/mode";
import { makeOneAd, type Step } from "./runAd";
import { makeOneVideo } from "./runVideo";

/** The brief form loads with this café example, editable (1 render, so a first live run costs one image edit). */
const EXAMPLE = {
  brief: "A runner at sunrise on a mountain trail, wearing our new trail shoes.",
  use: "Fitness" as Use,
  durationDays: 14,
  renderCap: 3,
  scene: "a mountain trail at sunrise, golden light, hills in the distance",
  product: "trail running shoes, worn on the feet",
  /** What the runner does in a video (used only when Media is Video). */
  motion: "The runner runs along the trail toward the camera, steady pace, then looks into the lens. Keep the face unchanged.",
};

export function AgentFlow({ onChanged, preview, video }: { onChanged: () => void; preview?: { find: FindResponse | null; renders: number }; video?: VideoStatus | null }) {
  const [brief, setBrief] = useState(EXAMPLE.brief);
  const [use, setUse] = useState<Use>(EXAMPLE.use);
  const [durationDays, setDays] = useState(EXAMPLE.durationDays);
  const [renderCap, setCap] = useState(preview?.renders ?? EXAMPLE.renderCap);
  const [scene, setScene] = useState(EXAMPLE.scene);
  const [product, setProduct] = useState(EXAMPLE.product);
  const [motion, setMotion] = useState(EXAMPLE.motion);
  const [media, setMedia] = useState<"image" | "video">("image");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [find, setFind] = useState<FindResponse | null>(preview?.find ?? null);
  const [asked, setAsked] = useState<RequestResponse | null>(null);
  const [status, setStatus] = useState<LicenceStatus | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const started = useRef(false);
  /** Set when the licence is requested for a video campaign: after approval the agent makes videos, not images. */
  const videoRun = useRef<{ seconds: number; estUsd: number } | null>(null);
  const add = (s: Step) => setSteps((x) => [...x, s]);

  const wantsVideo = media === "video" && !!video?.enabled;
  const problems = [
    ...textProblems(brief),
    ...(scene ? textProblems(scene, "the scene", FIELD_MAX) : []),
    ...(product ? textProblems(product, "the product", FIELD_MAX) : []),
    ...(wantsVideo && motion ? textProblems(motion, "the video action", FIELD_MAX) : []),
  ];

  // 4 → 5: watch the requested licence; once the creator approves, the agent makes the renders.
  useEffect(() => {
    if (!asked || preview) return;
    let stop = false;
    const tick = async () => {
      try {
        const l = await views.getLicence(asked.licenceId);
        if (stop || !l) return;
        setStatus(l.status);
        if (l.status === "Active" && !started.current) {
          started.current = true;
          const room = l.renderCap - l.rendersUsed - l.rendersReserved;
          const v = videoRun.current;
          const what = v ? (room === 1 ? "video" : "videos") : room === 1 ? "ad" : "ads";
          add({ text: `${asked.name} approved the licence (token #${l.tokenId}). The agent makes ${room} ${what}, one at a time.`, tone: "ok" });
          for (let i = 0; i < room; i++) {
            add({ text: `${v ? "Video" : "Ad"} ${i + 1} of ${room}`, tone: "wait" });
            try {
              if ((v ? await makeOneVideo(asked.licenceId, add, v) : await makeOneAd(asked.licenceId, add)) !== "submitted") break;
            } catch (e) {
              add({ text: (e as Error).message, tone: "bad" });
              break;
            } finally {
              onChanged();
            }
          }
          add({ text: "Done. Each ad now waits for the creator's approval in their wallet; nothing is paid until then.", tone: "ok" });
        }
      } catch {
        // a missed poll is retried on the next tick
      }
    };
    void tick();
    const t = setInterval(() => {
      if (!started.current) void tick();
    }, 5000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [asked, preview, onChanged]);

  async function findCreators() {
    setBusy("Screening the brief for banned uses, filtering creators, ranking…");
    setError(null);
    setFind(null);
    setAsked(null);
    setSteps([]);
    started.current = false;
    try {
      const body: CampaignRequest = { brief, use, durationDays, renderCap, scene, product, media: wantsVideo ? "video" : "image", ...(wantsVideo && motion.trim() ? { motion: motion.trim() } : {}) };
      setFind(await api<FindResponse>("/api/agent/find", body));
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  async function request(creatorId?: string) {
    if (!find || find.status !== "ok") return;
    setBusy(creatorId ? `Requesting a licence from ${creatorId}…` : "The agent chooses its #1 and requests a licence…");
    setError(null);
    try {
      const r = await api<RequestResponse>("/api/agent/request", { campaignId: find.campaignId, ...(creatorId ? { creatorId } : {}) });
      videoRun.current = wantsVideo && video ? { seconds: video.seconds, estUsd: video.estUsd } : null;
      setAsked(r);
      setStatus("Pending");
      onChanged();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  }

  const ok = find?.status === "ok" ? find : null;
  const isDemo = !!ok?.demo;
  const canChoose = !!ok && !isDemo && ok.ready && ok.top.some((c) => c.fitsBudget) && !asked;

  return (
    <div className="flex flex-col gap-[18px]">
      <section id="brief" className="flex scroll-mt-4 flex-col gap-4 rounded-[22px] bg-lime p-5 text-ink sm:p-6" aria-label="Brief your agent">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-[22px] font-bold">Brief your agent</h2>
          <p className="m-0 text-[14px] text-ink/70">
            What the ad shows, where it&apos;s used, for how long and how many renders. Banned uses are refused first; the agent shortlists only creators
            whose on-chain terms fit.
          </p>
        </div>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!problems.length && !preview) void findCreators();
          }}
        >
          <Lbl text="What the ad shows">
            <textarea className={`${inputClass} min-h-24 resize-y`} value={brief} maxLength={BRIEF_MAX} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. Morning coffee campaign for a neighbourhood café" />
          </Lbl>
          <div className={`grid grid-cols-2 gap-3 ${video?.enabled ? "md:grid-cols-8" : "md:grid-cols-7"}`}>
            <Lbl text="Category" className="col-span-2 md:col-span-1">
              <select className={inputClass} value={use} onChange={(e) => setUse(e.target.value as Use)}>
                {USES.map((u) => (
                  <option key={u} value={u}>
                    {USE_LABELS[u]}
                  </option>
                ))}
              </select>
            </Lbl>
            <Lbl text="Days of use">
              <input className={inputClass} type="number" min={1} max={MAX_DAYS_LIMIT} value={durationDays} onChange={(e) => setDays(Number(e.target.value))} />
            </Lbl>
            <Lbl text="Renders">
              <input className={inputClass} type="number" min={1} max={20} value={renderCap} onChange={(e) => setCap(Number(e.target.value))} />
            </Lbl>
            {video?.enabled && (
              <Lbl text="Media">
                <select className={inputClass} value={media} onChange={(e) => setMedia(e.target.value as "image" | "video")}>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </Lbl>
            )}
            <Lbl text="Scene (optional)" className="col-span-2">
              <input className={inputClass} value={scene} maxLength={FIELD_MAX} onChange={(e) => setScene(e.target.value)} placeholder="the agent writes it if empty" />
            </Lbl>
            <Lbl text="Product (optional)" className="col-span-2">
              <input className={inputClass} value={product} maxLength={FIELD_MAX} onChange={(e) => setProduct(e.target.value)} placeholder="the agent writes it if empty" />
            </Lbl>
            {wantsVideo && (
              <Lbl text="Video action (optional)" className="col-span-2">
                <input className={inputClass} value={motion} maxLength={FIELD_MAX} onChange={(e) => setMotion(e.target.value)} placeholder="what the person does in the clip; the brief if empty" />
              </Lbl>
            )}
          </div>
          {problems.length > 0 && brief && (
            <ul className="m-0 pl-5 text-[14px] text-bad">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!!busy || problems.length > 0} className={btnClass("ink", "min-h-12 px-6")}>
              {busy && !asked && !ok ? "Finding…" : "Find creators"}
            </button>
            {busy ? <span className="text-[13px] text-ink/70">{busy}</span> : <span className="text-[13px] text-ink/70">No transaction: nothing is asked or paid until you pick a creator.</span>}
          </div>
        </form>
      </section>

      {error instanceof NotConnectedError ? <NotConnected what="The brand agent (/api/agent)" /> : error ? <ErrorCard>{(error as Error).message}</ErrorCard> : null}

      {find?.status === "blocked" && (
        <section className="flex flex-col gap-2 rounded-[22px] bg-bad-bg p-5 text-ink ring-1 ring-bad/30" aria-label="Refused">
          <b className="text-[16px]">Refused: nothing was asked and nothing was paid</b>
          <ul className="m-0 pl-5 text-[14px]">
            {find.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <span className={`text-[13px] ${MUTED}`}>Change the brief and try again.</span>
        </section>
      )}

      {isDemo && (
        <p role="status" className="m-0 rounded-[16px] bg-violet-soft px-4 py-3 text-[14px] font-semibold text-wait">
          {DEMO_BANNER}
        </p>
      )}

      {find && find.status !== "blocked" && (
        <section className={`${SURFACE} flex flex-col gap-4 p-5 sm:p-6`} aria-label="The agent's shortlist">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-grey">The agent&apos;s shortlist</span>
              <h2 className="m-0 font-display text-[clamp(22px,3.4vw,30px)] font-extrabold leading-[1.05]">{ok ? "Top 3 for this brief" : "No creator fits"}</h2>
              <p className={`m-0 text-[14px] ${MUTED}`}>
                {ok
                  ? `Filtered on the creators' on-chain terms${isDemo ? "" : " and your limits"}, then ranked by the agent from public profiles and terms only (no images). ${isDemo ? "" : ok.ready ? `Budget left: ${formatNear(ok.budgetLeft)}.` : "Deposit escrow and set your spending limits (Set up once, above) to request a licence."}`
                  : find.status === "no_creator" ? find.reasons.join("; ") : ""}
              </p>
            </div>
            {ok && !isDemo && (
              <button type="button" disabled={!canChoose || !!busy || !!preview} onClick={() => void request()} className={btnClass("lime", "min-h-11")}>
                Let the agent choose
              </button>
            )}
          </div>

          {ok && (
            <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-3">
              {ok.top.map((c, i) => (
                <ShortCard key={c.creatorId} c={c} rank={i + 1} ready={ok.ready} demo={isDemo} renders={renderCap} disabled={!!busy || !!asked || !!preview} onRequest={() => void request(c.creatorId)} chosen={asked?.creatorId === c.creatorId} />
              ))}
            </ol>
          )}

          {find.notEligible.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-[15px] font-bold">Not eligible</h3>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {find.notEligible.map((n) => (
                  <li key={n.creatorId} className="flex flex-wrap items-baseline gap-x-2 rounded-[14px] bg-paper px-3 py-2 text-[14px]">
                    <b>{profileOf(n.creatorId)?.name ?? n.creatorId}</b>
                    <SyntheticBadge accountId={n.creatorId} />
                    <span className={MUTED}>{n.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {asked && (
        <section className="flex flex-col gap-3 rounded-[22px] bg-ink p-5 text-white sm:p-6" aria-label="Agent console">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-[20px] font-bold">
              {status === "Pending" ? `Waiting for ${asked.name}` : status === "Declined" ? `${asked.name} declined` : status === "Active" ? `Licensed by ${asked.name}` : `Licence ${status ?? "…"}`}
            </h2>
            <StatusPill kind={status === "Active" ? "licensed" : status === "Declined" ? "revoked" : "waiting"}>{status ?? "Pending"}</StatusPill>
          </div>
          <p className="m-0 text-[13px] text-grey-dark">
            Licence #{asked.licenceId} requested ({asked.by}) by your agent&apos;s function-call key ·{" "}
            <a href={txUrl(asked.tx)} target="_blank" rel="noreferrer" className="text-lime underline">
              transaction ↗
            </a>
            {status === "Pending" && " · checking every 5 s; the creator approves in their own wallet"}
          </p>
          {steps.length > 0 && (
            <ol className="m-0 flex list-none flex-col gap-1 rounded-[14px] bg-white/5 p-3 font-mono text-[12px]">
              {steps.map((s, i) => (
                <li key={i} className={`break-all ${s.tone === "ok" ? "text-lime" : s.tone === "bad" ? "text-coral" : "text-grey-dark"}`}>
                  {s.text}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}

/** A label over its field, as on the earlier brief form. */
function Lbl({ text, className = "", children }: { text: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="text-[14px] font-medium text-ink/70">{text}</span>
      {children}
    </label>
  );
}

function ShortCard({ c, rank, ready, demo, renders, disabled, onRequest, chosen }: { c: ShortlistCard; rank: number; ready: boolean; demo: boolean; renders: number; disabled: boolean; onRequest: () => void; chosen: boolean }) {
  const p = profileOf(c.creatorId);
  return (
    <li className={`${SURFACE} flex min-w-0 flex-col overflow-hidden ${c.fitsBudget ? "" : "opacity-70"}`}>
      <div className="relative aspect-[16/10] w-full bg-paper">
        {p ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.card} alt={p.synthetic ? `${p.name}: AI-generated face, not a real person` : p.name} className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center">
            <Initial name={c.creatorId} size={64} />
          </span>
        )}
        <span className={`absolute left-3 top-3 ${CHIP} bg-ink text-lime`}>#{rank}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a href={accountUrl(c.creatorId)} target="_blank" rel="noreferrer" className="min-w-0 truncate text-[17px] font-bold text-ink no-underline hover:underline" title={c.creatorId}>
            {c.name}
          </a>
          {demo ? null : ready ? (
            <StatusPill kind={c.fitsBudget ? "licensed" : "revoked"}>{c.fitsBudget ? "Fits budget: yes" : "Fits budget: no"}</StatusPill>
          ) : (
            <StatusPill kind="neutral">Budget: not set</StatusPill>
          )}
        </div>
        <SyntheticBadge accountId={c.creatorId} />
        <span className="tnum text-[14px]">
          <b>{formatNear(c.price)}</b> per render × {renders} = <b>{formatNear(c.total)}</b>
        </span>
        <span className="text-[13px]">
          {c.reason} <span className={MUTED}>({c.by === "model" ? "agent" : "rule"})</span>
        </span>
        <div className="mt-auto pt-1">
          {demo ? (
            <span className="text-[13px] text-grey">Demo mode: no licence is requested.</span>
          ) : chosen ? (
            <span className={`text-[13px] font-semibold text-ok`}>Requested</span>
          ) : !ready ? (
            <a href="#setup" className={btnClass("outline", "min-h-11")}>
              Set up first ↑
            </a>
          ) : (
            <button type="button" disabled={disabled || !c.fitsBudget} onClick={onRequest} className={btnClass(c.fitsBudget ? "ink" : "outline", "min-h-11")} title={c.fitsBudget ? undefined : "Over your budget: can't be requested"}>
              {c.fitsBudget ? "Request licence" : "Over your budget"}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
