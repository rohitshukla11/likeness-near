/**
 * How an ad file is shown: an image as an <img>, a video ad in a player with its label over it (the clip itself is
 * never re-encoded, so the label lives here and in the receipt). The bytes come from /api/media/<sha256>, private
 * until the contract says Licensed.
 */
import { VIDEO_LABEL } from "@/lib/video/config";

export const isVideo = (mime: string | undefined) => !!mime && mime.startsWith("video/");

export function LabelledVideo({ src, className = "", fit = "cover" }: { src: string; className?: string; fit?: "cover" | "contain" }) {
  return (
    <div className={`relative h-full w-full bg-ink ${className}`}>
      <video src={src} controls muted playsInline loop preload="metadata" aria-label={VIDEO_LABEL} className={`block h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`} />
      <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-semibold text-lime">{VIDEO_LABEL}</span>
    </div>
  );
}

export function AdMedia({ src, mime, alt, className = "", fit = "cover" }: { src: string; mime: string | undefined; alt: string; className?: string; fit?: "cover" | "contain" }) {
  if (isVideo(mime)) return <LabelledVideo src={src} className={className} fit={fit} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"} ${className}`} />;
}
