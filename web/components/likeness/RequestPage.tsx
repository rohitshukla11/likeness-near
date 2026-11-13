"use client";

/**
 * One ad, as its creator sees it. "Agents propose. Only the human consents to their face being used." The page
 * downloads the exact file, hashes it here, shows those same bytes, and the approval the creator signs names that
 * hash: approve_render(sha256) pays them and records the receipt; reject_render releases the reservation and doesn't
 * count toward the cap. If the bytes don't hash to the ad's sha256, nothing can be approved.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { AiTag, AppPage, btnClass, Card, ErrorCard } from "@/components/ds";
import { NotConnected } from "@/components/ds/NotConnected";
import { runTx, TxLine, type TxState } from "./TxLine";
import { isSelfLicence, SELF_LICENCE_NOTE } from "./SelfLicence";
import { SyntheticNote } from "./Synthetic";
import { api, NotConnectedError } from "@/lib/api";
import { sha256OfBytes } from "@/lib/capture";
import { VIDEO_LABEL } from "@/lib/video/config";
import { isVideo, LabelledVideo } from "./LabelledVideo";
import { calls } from "@/lib/near/methods";
import { useWallet } from "@/lib/near/wallet";
import { formatNear, USE_LABELS } from "@/lib/rules";
import type { RenderItem } from "@/lib/types";

export function RequestPage({ sha256 }: { sha256: string }) {
  const w = useWallet();
  const [item, setItem] = useState<RenderItem | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [shown, setShown] = useState<{ url: string; sha: string } | null>(null);
  const [tx, setTx] = useState<TxState>({ kind: "idle" });

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const it = await api<RenderItem>(`/api/renders/${sha256}`);
        if (cancelled) return;
        setItem(it);
        const res = await fetch(it.mediaUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`the ad's file couldn't be loaded (HTTP ${res.status})`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        const sha = await sha256OfBytes(bytes);
        revoke = URL.createObjectURL(new Blob([bytes as BlobPart], { type: res.headers.get("content-type") ?? "image/jpeg" }));
        if (!cancelled) setShown({ url: revoke, sha });
      } catch (e) {
        if (!cancelled) setError(e);
      }
    })();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [sha256]);

  const matches = shown?.sha === sha256;
  const mine = !!item && w.accountId === item.licence.creator;
  const open = item?.receipt.status === "Reserved";

  return (
    <AppPage title="Review this ad" description="Nothing is paid or released until you approve this exact file.">
      {error instanceof NotConnectedError ? (
        <NotConnected what="This ad (/api/renders)" />
      ) : error ? (
        <ErrorCard>{(error as Error).message}</ErrorCard>
      ) : null}
      {item && (
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card>
            <div className="relative overflow-hidden rounded-[14px] bg-paper">
              {shown ? (
                isVideo(item.mime) ? (
                  <div className="aspect-video w-full">
                    <LabelledVideo src={shown.url} fit="contain" />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shown.url} alt={`The ad ${item.licence.brand} made with your face`} className="w-full" />
                )
              ) : (
                <div className="aspect-square" />
              )}
              <AiTag className="absolute left-3 top-3" />
            </div>
            <p className="m-0 text-[13px] text-grey">
              {isVideo(item.mime)
                ? `${VIDEO_LABEL}: a video made from your consented photo, outside NEAR AI's TEE. Only you can confirm it's you: watch it and decide.`
                : "AI-edited from the creator's consented photo."}
            </p>
            <p className="m-0 break-all text-[13px]">
              sha256 <code>{sha256}</code>{" "}
              {shown && (matches ? <span className="text-ok">matches the file shown</span> : <span className="text-bad">does NOT match the file shown</span>)}
            </p>
          </Card>
          <div className="flex flex-col gap-[18px]">
            <Card title="The deal">
              <p className="m-0 text-[15px]">
                <b>{item.licence.brand}</b> · {USE_LABELS[item.licence.use]} · {formatNear(item.receipt.amount)} to you on approval
              </p>
              {isSelfLicence(item.licence) && <p className="m-0 text-[14px] font-semibold text-wait">{SELF_LICENCE_NOTE}</p>}
              <SyntheticNote accountId={item.licence.creator} />
              <p className="m-0 text-[14px] text-grey">
                Licence #{item.licence.id}: {item.licence.rendersUsed}/{item.licence.renderCap} renders used
              </p>
              <details className="text-[14px]">
                <summary className="cursor-pointer">The exact prompt</summary>
                <p className="mt-2 mb-0 whitespace-pre-wrap text-grey">{item.prompt}</p>
              </details>
            </Card>
            <Card title="Is this you?">
              <p className="m-0 text-[16px] font-semibold">Only you can confirm it&apos;s you.</p>
              <p className="m-0 text-[13px] text-grey">
                No AI decides whether this is your face. The ad was only screened for safety (no minors, nothing sexualised, no other people)
                {item.faceCheck.safety === "passed" ? ": passed." : "."} Approve it only if it&apos;s you and you&apos;re happy with it.
              </p>
            </Card>
            <Card tone={open ? "lime" : "white"} title={open ? "Your decision" : `Decided: ${item.receipt.status}`}>
              {!w.accountId ? (
                <p className="m-0 text-[15px]">Connect the wallet of {item.licence.creator} to decide.</p>
              ) : !mine ? (
                <p className="m-0 text-[15px]">Only {item.licence.creator} can decide this ad.</p>
              ) : open ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!matches || tx.kind === "busy"}
                    className={btnClass("ink")}
                    onClick={() => void runTx(setTx, "Approve this ad", () => w.call(calls.approveRender(shown!.sha)))}
                  >
                    Approve and get paid
                  </button>
                  <button
                    type="button"
                    disabled={!matches || tx.kind === "busy"}
                    className={btnClass("danger")}
                    onClick={() => void runTx(setTx, "Reject this ad", () => w.call(calls.rejectRender(shown!.sha)))}
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <Link href={`/verify?sha256=${sha256}`} className="underline">
                  Verify this ad
                </Link>
              )}
              <TxLine s={tx} />
            </Card>
          </div>
        </div>
      )}
    </AppPage>
  );
}
