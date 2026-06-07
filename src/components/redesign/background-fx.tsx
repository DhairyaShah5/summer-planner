"use client";

import { useEffect } from "react";

const GRAIN_SVG =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>";

export function BackgroundFX() {
  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;

    const onMove = (e: PointerEvent) => {
      if (reduced) return;
      const target = e.target as Element | null;
      if (!target || !target.closest) return;
      const card = target.closest<HTMLElement>(".fx-card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const m = 4.5;
        card.style.setProperty("--ry", ((px - 0.5) * m * 2).toFixed(2) + "deg");
        card.style.setProperty("--rx", (-(py - 0.5) * m * 2).toFixed(2) + "deg");
        card.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (py * 100).toFixed(1) + "%");
        card.style.setProperty("--ty", "-5px");
      });
    };

    const onOut = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || !target.closest) return;
      const card = target.closest<HTMLElement>(".fx-card");
      if (!card) return;
      const related = e.relatedTarget as Node | null;
      if (related && card.contains(related)) return;
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--ty", "0px");
    };

    const onScroll = () => {
      const bar = document.getElementById("sp-scrollbar");
      if (!bar) return;
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const decorate = () => {
      document
        .querySelectorAll<HTMLElement>('[data-slot="card"], .card')
        .forEach((c) => c.classList.add("fx-card"));
    };
    decorate();
    const mo = new MutationObserver(() => {
      decorate();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      mo.disconnect();
    };
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: "-10%",
            top: "-15%",
            width: "55vw",
            height: "55vw",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--accent) 55%, transparent), transparent 65%)",
            filter: "blur(80px)",
            opacity: 0.55,
            animation: "aurora-drift 18s ease-in-out infinite",
          }}
        />
        <span
          style={{
            position: "absolute",
            right: "-15%",
            top: "10%",
            width: "50vw",
            height: "50vw",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--gold) 55%, transparent), transparent 65%)",
            filter: "blur(90px)",
            opacity: 0.4,
            animation: "aurora-drift 22s ease-in-out infinite reverse",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: "20%",
            bottom: "-20%",
            width: "60vw",
            height: "60vw",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--mint) 45%, transparent), transparent 65%)",
            filter: "blur(100px)",
            opacity: 0.35,
            animation: "aurora-drift 26s ease-in-out infinite",
          }}
        />
        <span
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("${GRAIN_SVG}")`,
            backgroundRepeat: "repeat",
            opacity: 0.06,
            mixBlendMode: "overlay",
            animation: "shimmer-grain 8s ease-in-out infinite",
          }}
        />
      </div>
      <div
        id="sp-scrollbar"
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: 2,
          width: "0%",
          background:
            "linear-gradient(90deg, var(--accent), color-mix(in oklch, var(--accent) 40%, transparent))",
          zIndex: 50,
          pointerEvents: "none",
          transition: "width .12s linear",
        }}
      />
    </>
  );
}
