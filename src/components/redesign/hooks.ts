"use client";

import { useEffect, useRef, useState } from "react";

export const motionScale: number = 1.0;

export function prefersReduced(): boolean {
  if (typeof window === "undefined") return false;
  return (
    !!window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useInView<T extends Element = HTMLElement>(
  opts?: { threshold?: number },
) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current || seen) return;
    const ob = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setSeen(true);
            ob.disconnect();
          }
        });
      },
      { threshold: opts && opts.threshold != null ? opts.threshold : 0.25 },
    );
    ob.observe(ref.current);
    return () => ob.disconnect();
  }, [seen, opts]);
  return [ref, seen] as const;
}

export function useCountUp(target: number, go: boolean, baseDur?: number) {
  const [val, setVal] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!go) return;
    const reduced = prefersReduced();
    const dur =
      reduced || motionScale === 0
        ? 0
        : (baseDur || 1100) * (1.2 - Math.min(1, motionScale) * 0.4);
    if (dur === 0) {
      setVal(target);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(target * e);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [go, target, baseDur]);
  return val;
}
