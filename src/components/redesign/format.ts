export function fmtMoney(n: number, opts?: { cents?: boolean }): string {
  const o = opts || {};
  const neg = n < 0;
  const abs = Math.abs(n);
  const s = abs.toLocaleString("en-US", {
    minimumFractionDigits: o.cents ? 2 : 0,
    maximumFractionDigits: o.cents ? 2 : 0,
  });
  return (neg ? "-" : "") + "$" + s;
}

export function fmtDate(
  iso: string,
  style?: "short" | "weekday" | "long",
): string {
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  if (style === "short") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (style === "weekday") {
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
