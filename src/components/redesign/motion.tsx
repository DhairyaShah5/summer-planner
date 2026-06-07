"use client";

import type { CSSProperties, ReactNode } from "react";
import { useInView, useCountUp, prefersReduced, motionScale } from "./hooks";
import { fmtMoney } from "./format";

type MoneyProps = {
  value: number;
  cents?: boolean;
  dur?: number;
  className?: string;
  go?: boolean;
};

export function Money({ value, cents, dur, className, go }: MoneyProps) {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const trigger = go != null ? go : seen;
  const v = useCountUp(value, trigger, dur);
  return (
    <span
      ref={ref}
      className={className}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {fmtMoney(v, { cents })}
    </span>
  );
}

type CountTextProps = {
  value: number;
  dur?: number;
};

export function CountText({ value, dur }: CountTextProps) {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const v = useCountUp(value, seen, dur || 1100);
  return (
    <span
      ref={ref}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {Math.round(v)}
    </span>
  );
}

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  from?: "up" | "left" | "right" | "zoom";
  style?: CSSProperties;
};

export function Reveal({
  children,
  delay = 0,
  y = 16,
  from = "up",
  style,
}: RevealProps) {
  const [ref, seen] = useInView<HTMLDivElement>({ threshold: 0.05 });
  const reduced = motionScale === 0 || prefersReduced();
  const ms = reduced ? 0 : 680;
  const hidden =
    from === "left"
      ? `translateX(-${y + 8}px)`
      : from === "right"
        ? `translateX(${y + 8}px)`
        : from === "zoom"
          ? "scale(.92)"
          : `translateY(${y}px) scale(.97)`;
  return (
    <div
      ref={ref}
      style={{
        height: "100%",
        opacity: seen ? 1 : 0,
        transform: seen ? "none" : hidden,
        filter: seen || reduced ? "none" : "blur(8px)",
        transition: ms
          ? `opacity ${ms}ms ease ${delay}ms, transform ${ms}ms cubic-bezier(.16,1,.3,1) ${delay}ms, filter ${ms}ms ease ${delay}ms`
          : "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
