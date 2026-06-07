"use client";

import type { ReactNode } from "react";

type PillTone = "received" | "upcoming" | "accent";

type PillProps = {
  children: ReactNode;
  tone?: PillTone;
};

export function Pill({ children, tone }: PillProps) {
  const tones: Record<PillTone, { bg: string; fg: string }> = {
    received: {
      bg: "color-mix(in oklch, var(--mint) 18%, transparent)",
      fg: "var(--mint-ink)",
    },
    upcoming: {
      bg: "color-mix(in oklch, var(--ink-1) 8%, transparent)",
      fg: "var(--ink-2)",
    },
    accent: {
      bg: "color-mix(in oklch, var(--accent) 16%, transparent)",
      fg: "var(--accent-ink)",
    },
  };
  const t = tones[tone || "upcoming"];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        background: t.bg,
        color: t.fg,
        letterSpacing: ".01em",
      }}
    >
      {children}
    </span>
  );
}

type CatDotProps = {
  hue: number;
  size?: number;
};

export function CatDot({ hue, size = 10 }: CatDotProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 3,
        background: `oklch(0.7 0.2 ${hue})`,
        flex: "none",
        display: "inline-block",
      }}
    />
  );
}

type AccountGlyphProps = {
  hue: number;
  icon: ReactNode;
  size?: number;
};

export function AccountGlyph({ hue, icon, size = 40 }: AccountGlyphProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        display: "grid",
        placeItems: "center",
        flex: "none",
        background: `color-mix(in oklch, oklch(0.68 0.14 ${hue}) 18%, transparent)`,
        color: `oklch(0.55 0.14 ${hue})`,
      }}
    >
      {icon}
    </span>
  );
}
