"use client";

/**
 * Scroll-driven motion without an animation library: one IntersectionObserver per element. Content is
 * hidden only while it waits to be revealed, never when motion is reduced or the observer is missing.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (on: () => void) => {
  const m = window.matchMedia(REDUCED);
  m.addEventListener("change", on);
  return () => m.removeEventListener("change", on);
};

/** The user's reduced-motion preference (false on the server). */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);
}

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      const raf = requestAnimationFrame(() => setSeen(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return { ref, seen };
}

type RevealKind = "rv" | "from-l" | "from-r" | "pop" | "card-in";

/** Wraps children in an element that animates in (CSS classes in globals.css) when first seen. */
export function Reveal({
  kind = "rv",
  as: As = "div",
  delay,
  className = "",
  style,
  children,
}: {
  kind?: RevealKind;
  as?: "div" | "span" | "li" | "article" | "section";
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { ref, seen } = useInView<HTMLElement>();
  return (
    <As
      ref={ref as never}
      className={`${kind}${seen ? " in" : ""} ${className}`}
      style={{ ...style, transitionDelay: delay ? `${delay}s` : undefined }}
    >
      {children}
    </As>
  );
}

/**
 * Shows `to`, and when `start` turns true counts up to it from 0 (eased). The real value is what
 * renders on the server, without JavaScript, and under reduced motion: the count is decoration only.
 */
export function useCountUp(to: number, start: boolean, ms = 1600) {
  const reduced = usePrefersReducedMotion();
  const [v, setV] = useState(to);
  const animate = start && !reduced;
  useEffect(() => {
    if (!animate) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, animate]);
  return animate ? v : to;
}
