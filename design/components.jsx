/* Summer Planner — shared viz + motion primitives.
   Exports to window at the bottom so other babel scripts can use them. */
const { useState, useEffect, useRef, useCallback } = React;

/* ---- motion ------------------------------------------------------------- */
// global multiplier set by the app from the Tweaks "motion" control (0..1.4)
function motionScale() {
  const m = window.__SP_MOTION;
  return (typeof m === 'number') ? m : 1;
}
const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function useInView(opts) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current || seen) return;
    const ob = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { setSeen(true); ob.disconnect(); } });
    }, { threshold: opts && opts.threshold != null ? opts.threshold : 0.25 });
    ob.observe(ref.current);
    return () => ob.disconnect();
  }, [seen]);
  return [ref, seen];
}

// animate a number from 0 -> target with an ease, gated on `go`
function useCountUp(target, go, baseDur) {
  const [val, setVal] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (!go) return;
    const ms = prefersReduced ? 0 : (baseDur || 1100) * (1 / Math.max(0.0001, motionScale() === 0 ? 0.0001 : motionScale()));
    const dur = motionScale() === 0 || prefersReduced ? 0 : (baseDur || 1100) * (1.2 - Math.min(1, motionScale()) * 0.4);
    if (dur === 0) { setVal(target); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(target * e);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [go, target]);
  return val;
}

/* ---- formatting --------------------------------------------------------- */
function fmtMoney(n, opts) {
  const o = opts || {};
  const neg = n < 0;
  const abs = Math.abs(n);
  const s = abs.toLocaleString('en-US', {
    minimumFractionDigits: o.cents ? 2 : 0,
    maximumFractionDigits: o.cents ? 2 : 0,
  });
  return (neg ? '-' : '') + '$' + s;
}
function fmtDate(iso, style) {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  if (style === 'short') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (style === 'weekday') return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/* ---- Money (animated number) ------------------------------------------- */
function CountText({ value, dur }) {
  const [ref, seen] = useInView();
  const v = useCountUp(value, seen, dur || 1100);
  return <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(v)}</span>;
}
function Money({ value, cents, className, dur, go }) {
  const [ref, seen] = useInView();
  const trigger = go != null ? go : seen;
  const v = useCountUp(value, trigger, dur);
  return <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(v, { cents })}</span>;
}

/* ---- Progress Ring ------------------------------------------------------ */
function Ring({ value, size = 180, stroke = 16, track = 'rgba(0,0,0,.08)', color = 'var(--accent)', children, gradient, glow, secondaryValue, secondaryColor }) {
  const [ref, seen] = useInView();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const dur = motionScale() === 0 || prefersReduced ? 0 : 1.4 * (1.2 - Math.min(1, motionScale()) * 0.4);
  const id = useRef('rg' + Math.random().toString(36).slice(2)).current;
  return (
    <div ref={ref} style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        {gradient && (
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={gradient[0]} />
              <stop offset="100%" stopColor={gradient[1]} />
            </linearGradient>
          </defs>
        )}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {secondaryValue != null && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={secondaryColor || 'rgba(0,0,0,.12)'}
            strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c}
            strokeDashoffset={seen ? c * (1 - Math.max(0, Math.min(1, secondaryValue))) : c}
            style={{ transition: `stroke-dashoffset ${dur}s cubic-bezier(.22,1,.36,1) .15s` }} />
        )}
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={gradient ? `url(#${id})` : color}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={seen ? c * (1 - pct) : c}
          style={{ transition: `stroke-dashoffset ${dur}s cubic-bezier(.22,1,.36,1)`, filter: glow ? `drop-shadow(0 0 10px ${glow})` : 'none' }}
        />
      </svg>
      {children && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
      )}
    </div>
  );
}

/* ---- Donut (segmented) -------------------------------------------------- */
function Donut({ data, size = 200, stroke = 26, gap = 0.012, onHover }) {
  // data: [{label,total,hue}]
  const [ref, seen] = useInView();
  const total = data.reduce((s, d) => s + d.total, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const dur = motionScale() === 0 || prefersReduced ? 0 : 1.1 * (1.2 - Math.min(1, motionScale()) * 0.4);
  return (
    <div ref={ref} style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {data.map((d, i) => {
          const frac = d.total / total;
          const len = Math.max(0, (frac - gap) * c);
          const off = -acc * c;
          acc += frac;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={`oklch(0.68 0.14 ${d.hue})`} strokeWidth={stroke}
              strokeDasharray={`${seen ? len : 0} ${c}`} strokeDashoffset={off}
              strokeLinecap="butt"
              onMouseEnter={() => onHover && onHover(d)} onMouseLeave={() => onHover && onHover(null)}
              style={{ transition: `stroke-dasharray ${dur}s cubic-bezier(.22,1,.36,1) ${i * 0.06}s`, cursor: onHover ? 'pointer' : 'default' }} />
          );
        })}
      </svg>
    </div>
  );
}

/* ---- Area / line chart -------------------------------------------------- */
function AreaChart({ series, width = 600, height = 220, pad = 28 }) {
  // series: [{name,color,points:[{x,y}]}] with x = index label, y = value; multiple lines share x scale
  const [ref, seen] = useInView();
  const all = series.flatMap(s => s.points.map(p => p.y)).filter(v => v != null);
  const maxY = Math.max(1, ...all) * 1.15;
  const xs = series[0].points.map(p => p.x);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const xAt = (i) => pad + (xs.length === 1 ? innerW / 2 : (i / (xs.length - 1)) * innerW);
  const yAt = (v) => pad + innerH - (v / maxY) * innerH;
  const dur = motionScale() === 0 || prefersReduced ? 0 : 1.4 * (1.2 - Math.min(1, motionScale()) * 0.4);
  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ overflow: 'visible', display: 'block' }}>
        {/* gridlines */}
        {[0.25, 0.5, 0.75, 1].map((g, i) => (
          <line key={i} x1={pad} x2={width - pad} y1={pad + innerH * g} y2={pad + innerH * g}
            stroke="var(--hair)" strokeWidth="1" />
        ))}
        {xs.map((x, i) => (
          <text key={i} x={xAt(i)} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--ink-3)" fontFamily="var(--ui)">{x}</text>
        ))}
        {series.map((s, si) => {
          const pts = s.points.filter(p => p.y != null);
          const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(s.points.indexOf(p))} ${yAt(p.y)}`).join(' ');
          const area = `${line} L ${xAt(s.points.indexOf(pts[pts.length - 1]))} ${pad + innerH} L ${xAt(s.points.indexOf(pts[0]))} ${pad + innerH} Z`;
          const gid = `ar${si}`;
          const total = 1200;
          return (
            <g key={si}>
              {s.fill && (<>
                <defs>
                  <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={area} fill={`url(#${gid})`} opacity={seen ? 1 : 0} style={{ transition: `opacity ${dur}s ease ${0.3 + si * 0.1}s` }} />
              </>)}
              <path d={line} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                pathLength="1" strokeDasharray="1" strokeDashoffset={seen ? 0 : 1}
                style={{ transition: `stroke-dashoffset ${dur}s cubic-bezier(.4,0,.2,1) ${si * 0.12}s` }} />
              {pts.map((p, i) => (
                <circle key={i} cx={xAt(s.points.indexOf(p))} cy={yAt(p.y)} r="3.5" fill="var(--surface)" stroke={s.color} strokeWidth="2.5"
                  opacity={seen ? 1 : 0} style={{ transition: `opacity .3s ease ${dur * 0.7 + i * 0.04}s` }} />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ---- Bar chart ---------------------------------------------------------- */
function BarChart({ bars, height = 180, formatTop }) {
  // bars: [{label, value, color, ghost, current}]
  const [ref, seen] = useInView();
  const max = Math.max(1, ...bars.map(b => b.value || 0)) * 1.15;
  const dur = motionScale() === 0 || prefersReduced ? 0 : 0.9 * (1.2 - Math.min(1, motionScale()) * 0.4);
  return (
    <div ref={ref} style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height, width: '100%' }}>
      {bars.map((b, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums', opacity: seen ? 1 : 0, transition: `opacity .4s ease ${0.3 + i * 0.05}s` }}>
            {b.value != null ? (formatTop ? formatTop(b.value) : b.value) : ''}
          </div>
          <div style={{
            width: '100%', maxWidth: 46, borderRadius: '8px 8px 4px 4px',
            height: seen ? `${((b.value || 0) / max) * 100}%` : '0%',
            background: b.ghost ? 'var(--hair)' : (b.color || 'var(--accent)'),
            border: b.ghost ? '1.5px dashed var(--ink-4)' : 'none',
            outline: b.current ? '2px solid var(--accent)' : 'none', outlineOffset: 2,
            transition: `height ${dur}s cubic-bezier(.22,1,.36,1) ${i * 0.06}s`,
          }} />
          <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--ui)' }}>{b.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ---- Sparkline ---------------------------------------------------------- */
function Sparkline({ points, color = 'var(--accent)', width = 120, height = 36, fill = true, stretch }) {
  const [ref, seen] = useInView();
  const max = Math.max(...points), min = Math.min(...points);
  const rng = max - min || 1;
  const step = width / (points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${height - ((p - min) / rng) * (height - 6) - 3}`).join(' ');
  const gid = useRef('sp' + Math.random().toString(36).slice(2)).current;
  return (
    <svg ref={ref} viewBox={`0 0 ${width} ${height}`} width={stretch ? '100%' : width} height={height} preserveAspectRatio="none" style={{ overflow: 'visible', display: 'block' }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {fill && <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${gid})`} opacity={seen ? 1 : 0} style={{ transition: 'opacity .6s ease .2s' }} />}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
        pathLength="1" strokeDasharray="1" strokeDashoffset={seen ? 0 : 1} style={{ transition: 'stroke-dashoffset 1s ease' }} />
    </svg>
  );
}

/* ---- Progress bar (animated) ------------------------------------------- */
function ProgressBar({ pct, color }) {
  const [ref, seen] = useInView();
  const dur = (motionScale() === 0 || prefersReduced) ? 0 : 1.3;
  return (
    <div ref={ref} style={{ height: 12, borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--hair)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: seen ? `${Math.min(100, pct * 100)}%` : '0%', borderRadius: 999,
        background: color || 'linear-gradient(90deg, var(--gold), var(--accent))', transition: `width ${dur}s cubic-bezier(.22,1,.36,1)` }} />
    </div>
  );
}

/* ---- Stacked bars (vertical, animated) --------------------------------- */
function StackedBars({ data, height = 190, max, formatTop, gap = 8 }) {
  // data: [{ label, segments:[{value,hue}] }]
  const [ref, seen] = useInView();
  const totals = data.map(d => d.segments.reduce((s, x) => s + x.value, 0));
  const mx = max || Math.max(1, ...totals) * 1.12;
  const dur = (motionScale() === 0 || prefersReduced) ? 0 : 0.95;
  return (
    <div ref={ref} style={{ display: 'flex', alignItems: 'flex-end', gap, height, width: '100%' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 6, minWidth: 0 }}>
          <div style={{ font: '600 10px var(--ui)', color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', opacity: seen ? 1 : 0, transition: `opacity .4s ease ${0.3 + i * 0.04}s`, whiteSpace: 'nowrap' }}>{formatTop ? formatTop(totals[i]) : ''}</div>
          <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 30, height: seen ? `${(totals[i] / mx) * 100}%` : '0%', display: 'flex', flexDirection: 'column', borderRadius: '7px 7px 3px 3px', overflow: 'hidden', transition: `height ${dur}s cubic-bezier(.22,1,.36,1) ${i * 0.04}s` }}>
              {d.segments.map((s, si) => s.value > 0 && <div key={si} style={{ height: `${(s.value / (totals[i] || 1)) * 100}%`, background: `oklch(0.66 0.15 ${s.hue})` }} />)}
            </div>
          </div>
          <div style={{ font: '500 10.5px var(--ui)', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ---- Semicircle gauge -------------------------------------------------- */
function GaugeArc({ value, size = 200, stroke = 18, color = 'var(--accent)', track = 'var(--ring-track)', gradient, glow, children }) {
  const [ref, seen] = useInView();
  const r = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const len = Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const dur = (motionScale() === 0 || prefersReduced) ? 0 : 1.3;
  const id = useRef('ga' + Math.random().toString(36).slice(2)).current;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <div ref={ref} style={{ position: 'relative', width: size, height: size / 2 + stroke }}>
      <svg width={size} height={size / 2 + stroke} style={{ overflow: 'visible' }}>
        {gradient && <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={gradient[0]} /><stop offset="100%" stopColor={gradient[1]} /></linearGradient></defs>}
        <path d={arc} fill="none" stroke={track} strokeWidth={stroke} strokeLinecap="round" />
        <path d={arc} fill="none" stroke={gradient ? `url(#${id})` : color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={len} strokeDashoffset={seen ? len * (1 - pct) : len}
          style={{ transition: `stroke-dashoffset ${dur}s cubic-bezier(.22,1,.36,1)`, filter: glow ? `drop-shadow(0 0 8px ${glow})` : 'none' }} />
      </svg>
      {children && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>}
    </div>
  );
}

/* ---- Icons (simple stroke glyphs) -------------------------------------- */
function Icon({ name, size = 20, stroke = 1.8, color = 'currentColor' }) {
  const p = { fill: 'none', stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const paths = {
    home: <><path {...p} d="M3 10.5 12 4l9 6.5" /><path {...p} d="M5 9.5V20h14V9.5" /></>,
    cart: <><circle cx="9" cy="20" r="1.4" fill={color} stroke="none" /><circle cx="18" cy="20" r="1.4" fill={color} stroke="none" /><path {...p} d="M3 4h2l2.2 11h11l1.8-8H6" /></>,
    fork: <><path {...p} d="M7 3v7a2 2 0 0 0 2 2 2 2 0 0 0 2-2V3M9 12v9" /><path {...p} d="M16 3c-1.5 0-2 2-2 4s.5 4 2 4v10" /></>,
    bus: <><rect {...p} x="4" y="4" width="16" height="13" rx="2" /><path {...p} d="M4 11h16M8 17v3M16 17v3" /><circle cx="8" cy="14" r="1" fill={color} stroke="none" /><circle cx="16" cy="14" r="1" fill={color} stroke="none" /></>,
    play: <><circle {...p} cx="12" cy="12" r="9" /><path d="M10 8.5 16 12l-6 3.5z" fill={color} /></>,
    spark: <path {...p} d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />,
    heart: <path {...p} d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 15.5 12 20 12 20z" />,
    dots: <><circle cx="6" cy="12" r="1.5" fill={color} stroke="none" /><circle cx="12" cy="12" r="1.5" fill={color} stroke="none" /><circle cx="18" cy="12" r="1.5" fill={color} stroke="none" /></>,
    home2: <><path {...p} d="M3 10.5 12 4l9 6.5" /><path {...p} d="M5 9.5V20h14V9.5" /></>,
    grid: <><rect {...p} x="3" y="3" width="7" height="7" rx="1.5" /><rect {...p} x="14" y="3" width="7" height="7" rx="1.5" /><rect {...p} x="3" y="14" width="7" height="7" rx="1.5" /><rect {...p} x="14" y="14" width="7" height="7" rx="1.5" /></>,
    wallet: <><rect {...p} x="3" y="6" width="18" height="13" rx="2.5" /><path {...p} d="M3 10h18M17 14.5h.01" /></>,
    receipt: <><path {...p} d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" /><path {...p} d="M9 8h6M9 12h6" /></>,
    bank: <><path {...p} d="M4 10h16M5 10v8M19 10v8M9 10v8M15 10v8M3 20h18M12 3 4 8h16z" /></>,
    calendar: <><rect {...p} x="3" y="5" width="18" height="16" rx="2.5" /><path {...p} d="M3 9h18M8 3v4M16 3v4" /></>,
    gear: <><circle {...p} cx="12" cy="12" r="3.2" /><path {...p} d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></>,
    arrow: <path {...p} d="M5 12h14M13 6l6 6-6 6" />,
    arrowDown: <path {...p} d="M12 5v14M6 13l6 6 6-6" />,
    arrowUp: <path {...p} d="M12 19V5M6 11l6-6 6 6" />,
    plus: <path {...p} d="M12 5v14M5 12h14" />,
    check: <path {...p} d="M5 12.5 10 17 19 7" />,
    clock: <><circle {...p} cx="12" cy="12" r="9" /><path {...p} d="M12 7v5l3 2" /></>,
    flag: <><path {...p} d="M5 21V4M5 4h11l-1.5 4L16 12H5" /></>,
    target: <><circle {...p} cx="12" cy="12" r="9" /><circle {...p} cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.6" fill={color} stroke="none" /></>,
    sun: <><circle {...p} cx="12" cy="12" r="4.2" /><path {...p} d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12h2.5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" /></>,
    card: <><rect {...p} x="3" y="5" width="18" height="14" rx="2.5" /><path {...p} d="M3 9.5h18M6.5 14.5h3" /></>,
    pencil: <><path {...p} d="M4 20h4L19 9l-4-4L4 16v4z" /><path {...p} d="M14 6l4 4" /></>,
    trash: <><path {...p} d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></>,
    trend: <path {...p} d="M3 17l6-6 4 4 8-8M21 7v4M21 7h-4" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flex: 'none' }}>{paths[name] || paths.dots}</svg>;
}

/* ---- small UI atoms ----------------------------------------------------- */
function Pill({ children, tone }) {
  const tones = {
    received: { bg: 'color-mix(in oklch, var(--mint) 18%, transparent)', fg: 'var(--mint-ink)' },
    upcoming: { bg: 'color-mix(in oklch, var(--ink-1) 8%, transparent)', fg: 'var(--ink-2)' },
    accent:   { bg: 'color-mix(in oklch, var(--accent) 16%, transparent)', fg: 'var(--accent-ink)' },
  };
  const t = tones[tone] || tones.upcoming;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: t.bg, color: t.fg, letterSpacing: '.01em' }}>{children}</span>;
}

Object.assign(window, {
  useInView, useCountUp, motionScale, prefersReduced,
  fmtMoney, fmtDate, Money, CountText, Ring, Donut, AreaChart, BarChart, Sparkline, ProgressBar, StackedBars, GaugeArc, Icon, Pill,
});
