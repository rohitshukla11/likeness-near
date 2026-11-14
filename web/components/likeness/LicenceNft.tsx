"use client";

/**
 * The licence NFT as the contract draws it: the token's own on-chain SVG (`nft_token(id).metadata.media`), read straight
 * from the contract (no server, no keys). LicenceNftThumb is the small linked thumbnail used on licence cards and in
 * Verify; LicenceNftGrid lists every token an account holds (`nft_tokens_for_owner`). Reads are keyed by the licence's
 * current state (`stamp`), so the image is fetched again when the licence changes (e.g. ACTIVE → REVOKED).
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusPill, type PillKind } from "@/components/ds";
import { views, type TokenJson } from "@/lib/near/view";

const cache = new Map<string, Promise<TokenJson | null>>();
function tokenOf(id: string, stamp: string): Promise<TokenJson | null> {
  const key = `${id}|${stamp}`;
  if (!cache.has(key)) cache.set(key, views.getToken(id).catch((e) => (cache.delete(key), Promise.reject(e))));
  return cache.get(key)!;
}

/** The token's status, from its metadata `extra` (computed by the contract on read). */
export function tokenStatus(t: TokenJson | null | undefined): string | null {
  try {
    return (JSON.parse(t?.metadata?.extra ?? "{}") as { status?: string }).status ?? null;
  } catch {
    return null;
  }
}

const PILL: Record<string, PillKind> = { Active: "licensed", Revoked: "revoked", Expired: "expired", Exhausted: "expired" };

function Svg({ token, id }: { token: TokenJson | null | undefined; id: string }) {
  if (token === undefined) return <span className="block aspect-[4/3] w-full animate-pulse rounded-[10px] bg-black/10" aria-label="Loading the licence NFT" />;
  const media = token?.metadata?.media;
  if (!media) return <span className="flex aspect-[4/3] w-full items-center justify-center rounded-[10px] bg-black/5 px-2 text-center text-[11px] text-grey">No token yet</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={media} alt={`Licence NFT #${id}: ${tokenStatus(token) ?? "status unknown"}`} className="block w-full rounded-[10px]" />;
}

/** A small linked thumbnail: the on-chain image + "Licence NFT #id". */
export function LicenceNftThumb({ id, stamp = "", width = 120 }: { id: string; stamp?: string; width?: number }) {
  const key = `${id}|${stamp}`;
  // The result is kept with the key it was read for: a different key (the licence changed) shows loading, never a stale image.
  const [got, setGot] = useState<{ key: string; token: TokenJson | null } | null>(null);
  useEffect(() => {
    let stop = false;
    tokenOf(id, stamp)
      .then((t) => !stop && setGot({ key, token: t }))
      .catch(() => !stop && setGot({ key, token: null }));
    return () => {
      stop = true;
    };
  }, [id, stamp, key]);
  const token = got && got.key === key ? got.token : undefined;
  return (
    <Link href={`/licence/${id}`} className="flex shrink-0 flex-col gap-1 no-underline" style={{ width }} title={`Licence NFT #${id}: view the token`}>
      <Svg token={token} id={id} />
      <span className="text-[12px] font-semibold text-ink underline">Licence NFT #{id}</span>
    </Link>
  );
}

/** Every licence NFT an account holds, as cards: the on-chain image, its status and "View". */
export function LicenceNftGrid({ owner, stamp = "" }: { owner: string; stamp?: string }) {
  const key = `${owner}|${stamp}`;
  const [got, setGot] = useState<{ key: string; tokens: TokenJson[] | null } | null>(null);
  useEffect(() => {
    let stop = false;
    views
      .tokensForOwner(owner)
      .then((t) => !stop && setGot({ key, tokens: t }))
      .catch(() => !stop && setGot({ key, tokens: null }));
    return () => {
      stop = true;
    };
  }, [owner, key]);
  // Keep showing the last list while a refresh loads (the grid doesn't blink on every dashboard refresh).
  const tokens = got?.tokens ?? null;
  const error = !!got && got.key === key && got.tokens === null;
  if (error) return <p className="m-0 text-[14px] text-grey">The contract couldn&apos;t be read just now; reload to try again.</p>;
  if (!tokens)
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block aspect-[4/3] animate-pulse rounded-[14px] bg-black/10" />
        ))}
      </div>
    );
  if (!tokens.length) return <p className="m-0 text-[14px] text-grey">No licence NFTs yet: a token is minted to the brand when a creator approves a licence.</p>;
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
      {[...tokens].reverse().map((t) => {
        const status = tokenStatus(t);
        return (
          <li key={t.token_id} className="flex flex-col gap-2 rounded-[14px] bg-paper p-2">
            <Svg token={t} id={t.token_id} />
            <span className="flex flex-wrap items-center justify-between gap-2 px-1">
              <b className="text-[13px]">Licence NFT #{t.token_id}</b>
              {status && <StatusPill kind={PILL[status] ?? "neutral"}>{status}</StatusPill>}
            </span>
            <Link href={`/licence/${t.token_id}`} className="px-1 pb-1 text-[13px] font-semibold text-ink underline">
              View →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
