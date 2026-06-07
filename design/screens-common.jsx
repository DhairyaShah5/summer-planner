/* Summer Planner — shared screen atoms (loaded after components.jsx). */

function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ font: '600 clamp(26px,3.4vw,38px)/1.02 var(--display)', letterSpacing: '-.02em', color: 'var(--ink-1)', margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ margin: '7px 0 0', color: 'var(--ink-3)', font: '400 15px/1.4 var(--ui)' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'nowrap' }}>
      <div style={{ font: '600 12px/1 var(--ui)', letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{children}</div>
      {right && <div style={{ flex: 'none', whiteSpace: 'nowrap' }}>{right}</div>}
    </div>
  );
}

// big animated stat tile
function StatTile({ label, value, cents, icon, hue, spark, delta, sub, dur }) {
  const color = hue != null ? `oklch(0.68 0.14 ${hue})` : 'var(--accent)';
  return (
    <div className="card lift" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ font: '600 12px/1 var(--ui)', letterSpacing: '.04em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{label}</span>
        {icon && (
          <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: `color-mix(in oklch, ${color} 16%, transparent)`, color }}>
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ font: '600 clamp(24px,2.6vw,32px)/1 var(--display)', letterSpacing: '-.02em', color: 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }}>
          <Money value={value} cents={cents} dur={dur} />
        </div>
        {spark && <Sparkline points={spark} color={color} width={84} height={30} />}
      </div>
      {(sub || delta != null) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: '500 12.5px/1 var(--ui)', color: 'var(--ink-3)' }}>
          {delta != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: delta >= 0 ? 'var(--mint-ink)' : 'var(--accent-ink)', fontWeight: 600 }}>
              <Icon name={delta >= 0 ? 'arrowUp' : 'arrowDown'} size={13} />{Math.abs(delta)}%
            </span>
          )}
          {sub}
        </div>
      )}
    </div>
  );
}

function CatDot({ hue, size = 10 }) {
  return <span style={{ width: size, height: size, borderRadius: 3, background: `oklch(0.68 0.14 ${hue})`, flex: 'none' }} />;
}

function AccountGlyph({ hue, icon, size = 40 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 12, display: 'grid', placeItems: 'center', flex: 'none',
      background: `color-mix(in oklch, oklch(0.68 0.14 ${hue}) 18%, transparent)`, color: `oklch(0.55 0.14 ${hue})` }}>
      <Icon name={icon} size={size * 0.5} />
    </span>
  );
}

// staggered entrance wrapper
function Reveal({ children, delay = 0, y = 16, from = 'up', style }) {
  const [ref, seen] = useInView({ threshold: 0.05 });
  const reduced = motionScale() === 0 || prefersReduced;
  const ms = reduced ? 0 : 680;
  const hidden = ({
    up: `translateY(${y}px) scale(.97)`,
    left: `translateX(-${y + 8}px)`,
    right: `translateX(${y + 8}px)`,
    zoom: 'scale(.92)',
  })[from] || `translateY(${y}px) scale(.97)`;
  return (
    <div ref={ref} style={{
      height: '100%',
      opacity: seen ? 1 : 0,
      transform: seen ? 'none' : hidden,
      filter: (seen || reduced) ? 'none' : 'blur(8px)',
      transition: ms ? `opacity ${ms}ms ease ${delay}ms, transform ${ms}ms cubic-bezier(.16,1,.3,1) ${delay}ms, filter ${ms}ms ease ${delay}ms` : 'none',
      ...style,
    }}>{children}</div>
  );
}

Object.assign(window, { PageHeader, SectionLabel, StatTile, CatDot, AccountGlyph, Reveal });
