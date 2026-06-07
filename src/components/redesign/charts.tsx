"use client";

import * as React from "react";
import { useRef, useState, type ReactNode } from "react";
import { useInView, motionScale, prefersReduced } from "./hooks";

function animDur(base: number): number {
  if (motionScale === 0 || prefersReduced()) return 0;
  return base * (1.2 - Math.min(1, motionScale) * 0.4);
}

function randId(prefix: string) {
  return prefix + Math.random().toString(36).slice(2);
}

type RingProps = {
  value: number;
  size?: number;
  stroke?: number;
  track?: string;
  color?: string;
  children?: ReactNode;
  gradient?: [string, string];
  glow?: string;
  secondaryValue?: number;
  secondaryColor?: string;
};

export function Ring({
  value,
  size = 180,
  stroke = 16,
  track = "rgba(0,0,0,.08)",
  color = "var(--accent)",
  children,
  gradient,
  glow,
  secondaryValue,
  secondaryColor,
}: RingProps) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const dur = animDur(1.4);
  const id = useRef(randId("rg")).current;
  return (
    <div
      ref={ref}
      style={{ position: "relative", width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)", overflow: "visible" }}
      >
        {gradient && (
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={gradient[0]} />
              <stop offset="100%" stopColor={gradient[1]} />
            </linearGradient>
          </defs>
        )}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        {secondaryValue != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={secondaryColor || "rgba(0,0,0,.12)"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={
              seen ? c * (1 - Math.max(0, Math.min(1, secondaryValue))) : c
            }
            style={{
              transition: `stroke-dashoffset ${dur}s cubic-bezier(.22,1,.36,1) .15s`,
            }}
          />
        )}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={gradient ? `url(#${id})` : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={seen ? c * (1 - pct) : c}
          style={{
            transition: `stroke-dashoffset ${dur}s cubic-bezier(.22,1,.36,1)`,
            filter: glow ? `drop-shadow(0 0 10px ${glow})` : "none",
          }}
        />
      </svg>
      {children && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

type DonutDatum = { label: string; total: number; hue: number };

type DonutProps = {
  data: DonutDatum[];
  size?: number;
  stroke?: number;
  gap?: number;
  onHover?: (d: DonutDatum | null) => void;
  /** Optional palette override — caller controls the slice color for a
   *  given datum. Falls back to the default oklch(0.7 0.2 hue). */
  colorFor?: (d: DonutDatum) => string;
  /** When provided, the Donut renders a floating tooltip inside its
   *  center on hover, calling this with the hovered datum + its share. */
  tooltipContent?: (d: DonutDatum, pct: number) => React.ReactNode;
};

export function Donut({
  data,
  size = 200,
  stroke = 26,
  gap = 0.012,
  onHover,
  colorFor,
  tooltipContent,
}: DonutProps) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.total, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const dur = animDur(1.1);
  const hovered = hoverIdx != null ? data[hoverIdx] : null;
  const hoveredPct = hovered ? hovered.total / total : 0;
  return (
    <div
      ref={ref}
      style={{ width: size, height: size, position: "relative" }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {data.map((d, i) => {
          const frac = d.total / total;
          const len = Math.max(0, (frac - gap) * c);
          const off = -acc * c;
          acc += frac;
          const isHover = hoverIdx === i;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={colorFor ? colorFor(d) : `oklch(0.7 0.2 ${d.hue})`}
              strokeWidth={isHover ? stroke + 4 : stroke}
              strokeDasharray={`${seen ? len : 0} ${c}`}
              strokeDashoffset={off}
              strokeLinecap="butt"
              onMouseEnter={() => {
                setHoverIdx(i);
                onHover && onHover(d);
              }}
              onMouseLeave={() => {
                setHoverIdx(null);
                onHover && onHover(null);
              }}
              style={{
                transition: `stroke-dasharray ${dur}s cubic-bezier(.22,1,.36,1) ${i * 0.06}s, stroke-width 150ms ease`,
                cursor: onHover || tooltipContent ? "pointer" : "default",
                opacity:
                  hoverIdx == null || isHover ? 1 : 0.45,
              }}
            />
          );
        })}
      </svg>
      {tooltipContent && hovered && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--surface-2)",
            border: "1px solid var(--hair)",
            borderRadius: 10,
            padding: "10px 12px",
            pointerEvents: "none",
            boxShadow:
              "0 12px 32px -10px color-mix(in oklch, black 50%, transparent)",
            whiteSpace: "nowrap",
            zIndex: 10,
            maxWidth: size - 12,
          }}
        >
          {tooltipContent(hovered, hoveredPct)}
        </div>
      )}
    </div>
  );
}

type AreaSeries = {
  name: string;
  color: string;
  points: { x: string | number; y: number | null }[];
  fill?: boolean;
};

type AreaTooltipPoint = {
  name: string;
  color: string;
  value: number | null;
};

type AreaChartProps = {
  series: AreaSeries[];
  width?: number;
  height?: number;
  pad?: number;
  /** When provided, the chart tracks mouse position over the plot area
   *  and renders a floating tooltip + vertical guide at the nearest x
   *  index. The renderer receives the x label and each series' value
   *  at that index. */
  tooltipContent?: (
    x: string | number,
    points: AreaTooltipPoint[],
  ) => React.ReactNode;
};

export function AreaChart({
  series,
  width = 600,
  height = 220,
  pad = 28,
  tooltipContent,
}: AreaChartProps) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const all = series
    .flatMap((s) => s.points.map((p) => p.y))
    .filter((v): v is number => v != null);
  const maxY = Math.max(1, ...all) * 1.15;
  const xs = series[0].points.map((p) => p.x);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const xAt = (i: number) =>
    pad + (xs.length === 1 ? innerW / 2 : (i / (xs.length - 1)) * innerW);
  const yAt = (v: number) => pad + innerH - (v / maxY) * innerH;
  const dur = animDur(1.4);

  // Mouse → nearest x-index. SVG uses viewBox, so map clientX to viewBox
  // space using getBoundingClientRect.
  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!tooltipContent) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const vbX = ((e.clientX - rect.left) / rect.width) * width;
    if (xs.length === 1) return setHoverIdx(0);
    const idx = Math.round(((vbX - pad) / innerW) * (xs.length - 1));
    setHoverIdx(Math.max(0, Math.min(xs.length - 1, idx)));
  }
  return (
    <div ref={ref} style={{ width: "100%", position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ overflow: "visible", display: "block" }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {[0.25, 0.5, 0.75, 1].map((g, i) => (
          <line
            key={i}
            x1={pad}
            x2={width - pad}
            y1={pad + innerH * g}
            y2={pad + innerH * g}
            stroke="var(--hair)"
            strokeWidth="1"
          />
        ))}
        {xs.map((x, i) => (
          <text
            key={i}
            x={xAt(i)}
            y={height - 6}
            textAnchor="middle"
            fontSize="11"
            fill="var(--ink-3)"
            fontFamily="var(--ui)"
          >
            {x}
          </text>
        ))}
        {series.map((s, si) => {
          const pts = s.points.filter((p): p is { x: string | number; y: number } => p.y != null);
          if (pts.length === 0) return null;
          const line = pts
            .map(
              (p, i) =>
                `${i === 0 ? "M" : "L"} ${xAt(s.points.indexOf(p))} ${yAt(p.y)}`,
            )
            .join(" ");
          const area = `${line} L ${xAt(s.points.indexOf(pts[pts.length - 1]))} ${pad + innerH} L ${xAt(s.points.indexOf(pts[0]))} ${pad + innerH} Z`;
          const gid = `ar${si}`;
          return (
            <g key={si}>
              {s.fill && (
                <>
                  <defs>
                    <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={s.color}
                        stopOpacity="0.28"
                      />
                      <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={area}
                    fill={`url(#${gid})`}
                    opacity={seen ? 1 : 0}
                    style={{
                      transition: `opacity ${dur}s ease ${0.3 + si * 0.1}s`,
                    }}
                  />
                </>
              )}
              <path
                d={line}
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength="1"
                strokeDasharray="1"
                strokeDashoffset={seen ? 0 : 1}
                style={{
                  transition: `stroke-dashoffset ${dur}s cubic-bezier(.4,0,.2,1) ${si * 0.12}s`,
                }}
              />
              {pts.map((p, i) => (
                <circle
                  key={i}
                  cx={xAt(s.points.indexOf(p))}
                  cy={yAt(p.y)}
                  r="3.5"
                  fill="var(--surface)"
                  stroke={s.color}
                  strokeWidth="2.5"
                  opacity={seen ? 1 : 0}
                  style={{
                    transition: `opacity .3s ease ${dur * 0.7 + i * 0.04}s`,
                  }}
                />
              ))}
            </g>
          );
        })}
        {tooltipContent && hoverIdx != null && (
          <g pointerEvents="none">
            <line
              x1={xAt(hoverIdx)}
              x2={xAt(hoverIdx)}
              y1={pad}
              y2={pad + innerH}
              stroke="var(--ink-3)"
              strokeOpacity="0.4"
              strokeDasharray="3 4"
              strokeWidth="1"
            />
            {series.map((s, si) => {
              const v = s.points[hoverIdx]?.y;
              if (v == null) return null;
              return (
                <circle
                  key={si}
                  cx={xAt(hoverIdx)}
                  cy={yAt(v)}
                  r="5"
                  fill={s.color}
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              );
            })}
          </g>
        )}
      </svg>
      {tooltipContent && hoverIdx != null && (
        <AreaTooltip
          left={`${(xAt(hoverIdx) / width) * 100}%`}
          content={tooltipContent(
            xs[hoverIdx],
            series.map((s) => ({
              name: s.name,
              color: s.color,
              value: s.points[hoverIdx]?.y ?? null,
            })),
          )}
        />
      )}
    </div>
  );
}

function AreaTooltip({
  left,
  content,
}: {
  left: string;
  content: React.ReactNode;
}) {
  // Position the tooltip relative to the chart container; horizontally we
  // anchor to the hovered x (transform: translateX(-50%)) so it stays
  // centered above the point and is clamped near the edges by the parent.
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left,
        transform: "translate(-50%, -100%)",
        marginTop: -8,
        background: "var(--surface-2)",
        border: "1px solid var(--hair)",
        borderRadius: 10,
        padding: "10px 12px",
        pointerEvents: "none",
        boxShadow:
          "0 12px 32px -10px color-mix(in oklch, black 50%, transparent)",
        whiteSpace: "nowrap",
        zIndex: 10,
      }}
    >
      {content}
    </div>
  );
}

type Bar = {
  label: string;
  value: number | null;
  color?: string;
  ghost?: boolean;
  current?: boolean;
};

type BarChartProps = {
  bars: Bar[];
  height?: number;
  formatTop?: (v: number) => string;
};

export function BarChart({ bars, height = 180, formatTop }: BarChartProps) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const max = Math.max(1, ...bars.map((b) => b.value || 0)) * 1.15;
  const dur = animDur(0.9);
  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 14,
        height,
        width: "100%",
      }}
    >
      {bars.map((b, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            height: "100%",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--ink-2)",
              fontVariantNumeric: "tabular-nums",
              opacity: seen ? 1 : 0,
              transition: `opacity .4s ease ${0.3 + i * 0.05}s`,
            }}
          >
            {b.value != null
              ? formatTop
                ? formatTop(b.value)
                : b.value
              : ""}
          </div>
          <div
            style={{
              width: "100%",
              maxWidth: 46,
              borderRadius: "8px 8px 4px 4px",
              height: seen ? `${((b.value || 0) / max) * 100}%` : "0%",
              background: b.ghost ? "var(--hair)" : b.color || "var(--accent)",
              border: b.ghost ? "1.5px dashed var(--ink-4)" : "none",
              outline: b.current ? "2px solid var(--accent)" : "none",
              outlineOffset: 2,
              transition: `height ${dur}s cubic-bezier(.22,1,.36,1) ${i * 0.06}s`,
            }}
          />
          <div
            style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--ui)" }}
          >
            {b.label}
          </div>
        </div>
      ))}
    </div>
  );
}

type SparklineProps = {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  stretch?: boolean;
};

export function Sparkline({
  points,
  color = "var(--accent)",
  width = 120,
  height = 36,
  fill = true,
  stretch,
}: SparklineProps) {
  const [ref, seen] = useInView<SVGSVGElement>();
  const max = Math.max(...points);
  const min = Math.min(...points);
  const rng = max - min || 1;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const path = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${i * step} ${height - ((p - min) / rng) * (height - 6) - 3}`,
    )
    .join(" ");
  const gid = useRef(randId("sp")).current;
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      width={stretch ? "100%" : width}
      height={height}
      preserveAspectRatio="none"
      style={{ overflow: "visible", display: "block" }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && (
        <path
          d={`${path} L ${width} ${height} L 0 ${height} Z`}
          fill={`url(#${gid})`}
          opacity={seen ? 1 : 0}
          style={{ transition: "opacity .6s ease .2s" }}
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset={seen ? 0 : 1}
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
    </svg>
  );
}

type ProgressBarProps = {
  pct: number;
  color?: string;
};

export function ProgressBar({ pct, color }: ProgressBarProps) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const dur = motionScale === 0 || prefersReduced() ? 0 : 1.3;
  return (
    <div
      ref={ref}
      style={{
        height: 12,
        borderRadius: 999,
        background: "var(--surface-2)",
        border: "1px solid var(--hair)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: seen ? `${Math.min(100, pct * 100)}%` : "0%",
          borderRadius: 999,
          background: color || "linear-gradient(90deg, var(--gold), var(--accent))",
          transition: `width ${dur}s cubic-bezier(.22,1,.36,1)`,
        }}
      />
    </div>
  );
}

type StackedSegment = { value: number; hue: number };

type StackedData = { label: string; segments: StackedSegment[] };

type StackedBarsProps = {
  data: StackedData[];
  height?: number;
  max?: number;
  formatTop?: (v: number) => string;
  gap?: number;
};

export function StackedBars({
  data,
  height = 190,
  max,
  formatTop,
  gap = 8,
}: StackedBarsProps) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const totals = data.map((d) => d.segments.reduce((s, x) => s + x.value, 0));
  const mx = max || Math.max(1, ...totals) * 1.12;
  const dur = motionScale === 0 || prefersReduced() ? 0 : 0.95;
  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap,
        height,
        width: "100%",
      }}
    >
      {data.map((d, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            height: "100%",
            justifyContent: "flex-end",
            gap: 6,
            minWidth: 0,
          }}
        >
          <div
            style={{
              font: "600 10px var(--ui)",
              color: "var(--ink-3)",
              fontVariantNumeric: "tabular-nums",
              opacity: seen ? 1 : 0,
              transition: `opacity .4s ease ${0.3 + i * 0.04}s`,
              whiteSpace: "nowrap",
            }}
          >
            {formatTop ? formatTop(totals[i]) : ""}
          </div>
          <div
            style={{
              flex: 1,
              width: "100%",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 30,
                height: seen ? `${(totals[i] / mx) * 100}%` : "0%",
                display: "flex",
                flexDirection: "column",
                borderRadius: "7px 7px 3px 3px",
                overflow: "hidden",
                transition: `height ${dur}s cubic-bezier(.22,1,.36,1) ${i * 0.04}s`,
              }}
            >
              {d.segments.map(
                (s, si) =>
                  s.value > 0 && (
                    <div
                      key={si}
                      style={{
                        height: `${(s.value / (totals[i] || 1)) * 100}%`,
                        background: `oklch(0.66 0.15 ${s.hue})`,
                      }}
                    />
                  ),
              )}
            </div>
          </div>
          <div
            style={{
              font: "500 10.5px var(--ui)",
              color: "var(--ink-3)",
              whiteSpace: "nowrap",
            }}
          >
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}

type GaugeArcProps = {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  gradient?: [string, string];
  glow?: string;
  children?: ReactNode;
};

export function GaugeArc({
  value,
  size = 200,
  stroke = 18,
  color = "var(--accent)",
  track = "var(--ring-track)",
  gradient,
  glow,
  children,
}: GaugeArcProps) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const len = Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const dur = motionScale === 0 || prefersReduced() ? 0 : 1.3;
  const id = useRef(randId("ga")).current;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: size,
        height: size / 2 + stroke,
      }}
    >
      <svg
        width={size}
        height={size / 2 + stroke}
        style={{ overflow: "visible" }}
      >
        {gradient && (
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={gradient[0]} />
              <stop offset="100%" stopColor={gradient[1]} />
            </linearGradient>
          </defs>
        )}
        <path
          d={arc}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={arc}
          fill="none"
          stroke={gradient ? `url(#${id})` : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={seen ? len * (1 - pct) : len}
          style={{
            transition: `stroke-dashoffset ${dur}s cubic-bezier(.22,1,.36,1)`,
            filter: glow ? `drop-shadow(0 0 8px ${glow})` : "none",
          }}
        />
      </svg>
      {children && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
