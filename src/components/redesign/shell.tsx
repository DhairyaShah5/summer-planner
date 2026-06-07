"use client";

import type { ReactNode } from "react";
import { Money } from "./motion";
import { Sparkline } from "./charts";

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
};

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 24,
        flexWrap: "wrap",
      }}
    >
      <div>
        <h1
          style={{
            font: "600 clamp(26px,3.4vw,38px)/1.02 var(--display)",
            letterSpacing: "-.02em",
            color: "var(--ink-1)",
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: "7px 0 0",
              color: "var(--ink-3)",
              font: "400 15px/1.4 var(--ui)",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

type SectionLabelProps = {
  children: ReactNode;
  right?: ReactNode;
};

export function SectionLabel({ children, right }: SectionLabelProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 14,
        flexWrap: "nowrap",
      }}
    >
      <div
        style={{
          font: "600 12px/1 var(--ui)",
          letterSpacing: ".05em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </div>
      {right && <div style={{ flex: "none", whiteSpace: "nowrap" }}>{right}</div>}
    </div>
  );
}

type StatTileProps = {
  label: ReactNode;
  value: number;
  cents?: boolean;
  icon?: ReactNode;
  hue?: number;
  spark?: number[];
  delta?: number;
  sub?: ReactNode;
  dur?: number;
};

export function StatTile({
  label,
  value,
  cents,
  icon,
  hue,
  spark,
  delta,
  sub,
  dur,
}: StatTileProps) {
  const color = hue != null ? `oklch(0.68 0.14 ${hue})` : "var(--accent)";
  return (
    <div
      className="card"
      style={{
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minWidth: 0,
        background: "var(--surface)",
        border: "1px solid var(--hair)",
        borderRadius: "var(--radius)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            font: "600 12px/1 var(--ui)",
            letterSpacing: ".04em",
            color: "var(--ink-3)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        {icon && (
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              display: "grid",
              placeItems: "center",
              background: `color-mix(in oklch, ${color} 16%, transparent)`,
              color,
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div
          style={{
            font: "600 clamp(24px,2.6vw,32px)/1 var(--display)",
            letterSpacing: "-.02em",
            color: "var(--ink-1)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <Money value={value} cents={cents} dur={dur} />
        </div>
        {spark && (
          <Sparkline points={spark} color={color} width={84} height={30} />
        )}
      </div>
      {(sub || delta != null) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            font: "500 12.5px/1 var(--ui)",
            color: "var(--ink-3)",
          }}
        >
          {delta != null && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                color: delta >= 0 ? "var(--mint-ink)" : "var(--accent-ink)",
                fontWeight: 600,
              }}
            >
              {delta >= 0 ? "↑" : "↓"}
              {Math.abs(delta)}%
            </span>
          )}
          {sub}
        </div>
      )}
    </div>
  );
}
