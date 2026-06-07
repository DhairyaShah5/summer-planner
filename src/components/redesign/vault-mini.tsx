"use client";

import Link from "next/link";
import { useId } from "react";

type VaultMiniProps = {
  currentVault: number;
  vaultCap: number;
};

function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  return (
    (n < 0 ? "-" : "") +
    "$" +
    abs.toLocaleString("en-US", {
      maximumFractionDigits: 0,
    })
  );
}

export function VaultMini({ currentVault, vaultCap }: VaultMiniProps) {
  const pct = vaultCap > 0 ? Math.max(0, Math.min(1, currentVault / vaultCap)) : 0;
  const size = 34;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const gradId = useId().replace(/:/g, "");

  return (
    <Link
      href="/accounts"
      aria-label={`Vault: ${Math.round(pct * 100)}% of cap, ${fmtMoney(currentVault)} saved`}
      className="vault-mini-pill"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        background: "color-mix(in oklch, var(--ink-1) 5%, transparent)",
        border: "1px solid var(--hair)",
        borderRadius: 999,
        padding: "5px 15px 5px 5px",
        textDecoration: "none",
        color: "inherit",
        transition: "border-color .2s ease, background .2s ease",
        flex: "none",
      }}
    >
      <div style={{ position: "relative", width: size, height: size }}>
        <svg
          width={size}
          height={size}
          style={{ transform: "rotate(-90deg)", overflow: "visible" }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--gold, #f5c66b)" />
              <stop offset="100%" stopColor="var(--accent)" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--ring-track, color-mix(in oklch, var(--ink-1) 10%, transparent))"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset .8s cubic-bezier(.22,1,.36,1)" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
          }}
        >
          <span
            style={{
              font: "700 10px var(--font-display, var(--display))",
              color: "var(--ink-1)",
            }}
          >
            {Math.round(pct * 100)}
          </span>
        </div>
      </div>
      <div style={{ textAlign: "left" }}>
        <div
          style={{
            font: "600 9.5px/1 var(--font-ui, var(--ui))",
            letterSpacing: ".04em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
          }}
        >
          Vault
        </div>
        <div
          style={{
            font: "700 13px/1.25 var(--font-display, var(--display))",
            color: "var(--ink-1)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtMoney(currentVault)}
        </div>
      </div>
    </Link>
  );
}
