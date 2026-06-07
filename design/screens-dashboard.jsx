/* Summer Planner — Dashboard (bento overview, mirrors production cards). */

const GREEN = 'var(--pos)';
const GREEN_INK = 'var(--pos-ink)';

function CardHead({ icon, hue, title, sub, right }) {
  const color = hue != null ? `oklch(0.62 0.16 ${hue})` : 'var(--accent)';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 11, minWidth: 0 }}>
        {icon && <span style={{ width: 32, height: 32, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center', background: `color-mix(in oklch, ${color} 16%, transparent)`, color }}><Icon name={icon} size={17} /></span>}
        <div style={{ minWidth: 0 }}>
          <div style={{ font: '600 15px/1.1 var(--ui)', color: 'var(--ink-1)' }}>{title}</div>
          {sub && <div style={{ font: '500 12px/1.3 var(--ui)', color: 'var(--ink-3)', marginTop: 3 }}>{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}
function KV({ k, v, strong, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ font: '500 13.5px var(--ui)', color: 'var(--ink-3)' }}>{k}</span>
      <span style={{ font: `${strong ? 600 : 600} 14.5px var(--display)`, color: color || 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    </div>
  );
}

/* 1. Vault Progress (hero, spans 2 cols) */
function VaultProgress({ go }) {
  const { summary, goal } = window.SP;
  const v = summary.vault;
  return (
    <div className="card" style={{ padding: 24, height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 130% at 100% 0%, color-mix(in oklch, var(--accent) 12%, transparent), transparent 55%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
        <Ring value={v.pct} secondaryValue={1} size={172} stroke={17} track="var(--ring-track)"
          secondaryColor="color-mix(in oklch, var(--gold) 30%, transparent)" gradient={['var(--gold)', 'var(--accent)']}
          glow="color-mix(in oklch, var(--accent) 40%, transparent)">
          <div style={{ textAlign: 'center' }}>
            <div style={{ font: '600 32px/1 var(--display)', letterSpacing: '-.03em', color: 'var(--ink-1)' }}>{Math.round(v.pct * 100)}%</div>
            <div style={{ font: '600 10px/1 var(--ui)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 5 }}>funded</div>
          </div>
        </Ring>
        <div style={{ flex: 1, minWidth: 240 }}>
          <CardHead icon="target" title="Vault Progress" sub={`Projected ${fmtMoney(v.projected)} by ${fmtDate(goal.deadline, 'short')}`}
            right={<button className="icon-btn" onClick={() => go('accounts')}><Icon name="arrow" size={16} color="var(--ink-3)" /></button>} />
          <div style={{ font: '600 clamp(34px,4vw,46px)/1 var(--display)', letterSpacing: '-.03em', color: 'var(--ink-1)', margin: '4px 0 8px' }}>
            <Money value={v.current} cents dur={1500} />
          </div>
          <div style={{ font: '500 14px var(--ui)', color: 'var(--ink-2)', marginBottom: 14 }}>Saving toward {fmtMoney(v.projected)} · {(v.pct * 100).toFixed(1)}% of the way</div>
          <ProgressBar pct={v.pct} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9, font: '500 12.5px var(--ui)', color: 'var(--ink-3)' }}>
            <span style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>{(v.pct * 100).toFixed(1)}% funded</span>
            <span>{fmtMoney(v.remaining)} to {fmtMoney(goal.cap)} cap</span>
          </div>
        </div>
      </div>
    </div>
  );
}
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

/* 2. CO Budget (green) */
function CoBudget() {
  const c = window.SP.summary.co;
  const pct = Math.min(1, c.spentSummer / c.allowedNow);
  return (
    <div className="card" style={{ padding: 22, height: '100%', borderLeft: `4px solid ${GREEN}` }}>
      <CardHead icon="calendar" hue={152} title="CO Budget" sub={c.weekRange} />
      <div style={{ font: '600 clamp(30px,3.6vw,40px)/1 var(--display)', letterSpacing: '-.02em', color: GREEN_INK, margin: '6px 0 6px' }}>
        <Money value={c.leftNow} cents dur={1200} />
      </div>
      <div style={{ font: '500 14px var(--ui)', color: 'var(--ink-2)', marginBottom: 16 }}>left to spend overall</div>
      <ProgressBar pct={pct} color={GREEN} />
      <div style={{ font: '500 12.5px var(--ui)', color: 'var(--ink-3)', marginTop: 10 }}>Spent {fmtMoney(c.spentSummer, { cents: true })} · Maximum allowed {fmtMoney(c.allowedNow, { cents: true })}</div>
    </div>
  );
}

/* 3. Next Paycheck */
function NextPaycheck() {
  const p = window.SP.summary.nextPaycheck;
  const hue = window.SP.employers[p.employer].hue;
  return (
    <div className="card" style={{ padding: 20, height: '100%' }}>
      <CardHead icon="wallet" title="Next Paycheck" sub={fmtDate(p.date, 'weekday')} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <span style={{ font: '600 12px var(--ui)', padding: '4px 10px', borderRadius: 8, background: `color-mix(in oklch, oklch(0.62 0.16 ${hue}) 16%, transparent)`, color: `oklch(0.5 0.16 ${hue})` }}>{p.employer}</span>
        <Pill tone="upcoming"><Icon name="clock" size={12} /> Pending</Pill>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <KV k="Projected net" v={fmtMoney(p.actualNet, { cents: true })} />
        <KV k="Vault" v={fmtMoney(p.vault, { cents: true })} color="var(--accent-ink)" />
        <KV k="CO spend" v={fmtMoney(p.co, { cents: true })} />
      </div>
    </div>
  );
}

/* 4. Projected (end of summer) */
function ProjectedSummer() {
  const s = window.SP.summary;
  const items = [
    { label: 'Vault', value: s.vault.projected, hue: 285 },
    { label: 'CO', value: s.co.projectedCO, hue: 220 },
    { label: 'Buffer', value: s.buffer.projected, hue: 330 },
    { label: 'Rent paid', value: s.rentPaidProjected, hue: 35 },
  ];
  return (
    <div className="card" style={{ padding: 20, height: '100%' }}>
      <CardHead icon="trend" hue={152} title="Projected (end of summer)" sub="Projected allocations across summer" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {items.map(it => (
          <div key={it.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <CatDot hue={it.hue} size={8} /><span style={{ font: '500 12px var(--ui)', color: 'var(--ink-3)' }}>{it.label}</span>
            </div>
            <div style={{ font: '600 19px var(--display)', letterSpacing: '-.01em', color: 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(it.value, { cents: true })}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 5. Paycheck Status */
function PaycheckStatus() {
  const s = window.SP.summary.paychecks;
  return (
    <div className="card" style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHead icon="receipt" title="Paycheck Status" sub={`${s.pending} pending of ${s.total} total`} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '2px 0 14px' }}>
        <span style={{ font: '600 40px/1 var(--display)', letterSpacing: '-.02em', color: 'var(--ink-1)' }}><CountText value={s.pending} /></span>
        <span style={{ font: '500 15px var(--ui)', color: 'var(--ink-3)' }}>pending</span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {Array.from({ length: s.total }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < s.received ? GREEN : 'var(--hair)' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <Pill tone="received"><Icon name="check" size={12} /> {s.received} received</Pill>
        <Pill tone="upcoming"><Icon name="clock" size={12} /> {s.pending} pending</Pill>
      </div>
    </div>
  );
}

/* 6. Accounts (live balances) */
function AccountsLive({ go }) {
  const { accounts } = window.SP;
  return (
    <div className="card" style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHead icon="bank" title="Accounts" sub="Live balances right now"
        right={<button className="link-btn" onClick={() => go('accounts')}>All <Icon name="arrow" size={13} /></button>} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {accounts.map((a, i) => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 2px', borderTop: i ? '1px solid var(--hair)' : 'none' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: '600 13.5px var(--ui)', color: 'var(--ink-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
              <div style={{ font: '500 11px var(--ui)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>{a.tags[0]}</div>
            </div>
            <div style={{ font: '600 14.5px var(--display)', fontVariantNumeric: 'tabular-nums', color: a.kind === 'credit' && a.now > 0 ? 'var(--accent-ink)' : 'var(--ink-1)' }}>
              {a.kind === 'credit' && a.now > 0 ? '−' : ''}{fmtMoney(a.now, { cents: true })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 7. Recent Expenses */
function RecentExpenses({ go }) {
  const recent = window.SP.expenses.slice(0, 5);
  const catOf = id => window.SP.expenseCats.find(c => c.id === id);
  return (
    <div className="card" style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHead icon="receipt" hue={345} title="Recent Expenses" sub="Last 5 entries"
        right={<button className="link-btn" onClick={() => go('expenses')}>All <Icon name="arrow" size={13} /></button>} />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {recent.map((e, i) => {
          const c = catOf(e.category);
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 2px', borderTop: i ? '1px solid var(--hair)' : 'none' }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center', background: `color-mix(in oklch, oklch(0.68 0.14 ${c.hue}) 16%, transparent)`, color: `oklch(0.54 0.14 ${c.hue})` }}><CatDot hue={c.hue} size={8} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '600 13.5px var(--ui)', color: 'var(--ink-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.description}</div>
                <div style={{ font: '500 11.5px var(--ui)', color: 'var(--ink-3)' }}>{fmtDate(e.date, 'short')}</div>
              </div>
              <div style={{ font: '600 14px var(--display)', color: 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(e.amount, { cents: true })}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* 8. Allocation Breakdown donut */
function AllocationBreakdown() {
  const data = window.SP.allocationBreakdown.map(b => ({ ...b, total: b.amount }));
  return (
    <div className="card" style={{ padding: 20, height: '100%' }}>
      <CardHead icon="target" hue={285} title="Allocation Breakdown" sub="Allocated so far, by bucket" />
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <Donut data={data} size={130} stroke={20} />
        <div style={{ flex: 1, minWidth: 130, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <CatDot hue={b.hue} />
              <span style={{ flex: 1, font: '500 13px var(--ui)', color: 'var(--ink-2)' }}>{b.label}</span>
              <span style={{ font: '600 13px var(--display)', color: 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(b.pct * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VaultGrowthCard() {
  const w = window.SP.weekly;
  const pts = w.map((x, i) => ({ x: i % 2 === 0 ? x.endLabel : '', y: x.vaultBalance }));
  return (
    <div className="card" style={{ padding: 20, height: '100%' }}>
      <CardHead icon="trend" hue={285} title="Vault growth" sub={`Cumulative climb to ${fmtMoney(window.SP.goal.cap)}`} />
      <AreaChart series={[{ name: 'Vault', color: 'var(--accent)', fill: true, points: pts }]} width={680} height={200} />
    </div>
  );
}
function CoGaugeCard() {
  const c = window.SP.summary.co;
  const used = c.spentSummer / c.allowedNow;
  return (
    <div className="card" style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHead icon="calendar" hue={152} title="CO budget used" sub="Spent vs allowed (this week)" />
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', paddingBottom: 8 }}>
        <GaugeArc value={used} size={210} stroke={18} gradient={['var(--pos)', 'var(--accent)']} glow="color-mix(in oklch, var(--pos) 40%, transparent)">
          <div style={{ textAlign: 'center', paddingBottom: 4 }}>
            <div style={{ font: '600 30px var(--display)', letterSpacing: '-.02em', color: 'var(--ink-1)' }}>{Math.round(used * 100)}%</div>
            <div style={{ font: '500 12px var(--ui)', color: 'var(--ink-3)' }}>{fmtMoney(c.spentSummer)} of {fmtMoney(c.allowedNow)}</div>
          </div>
        </GaugeArc>
      </div>
    </div>
  );
}

function Dashboard({ go }) {
  const { summary } = window.SP;
  return (
    <div>
      <PageHeader title="Summer at a glance" subtitle={`${fmtDate(window.SP.TODAY.toISOString().slice(0,10), 'weekday')} · saving toward ${fmtMoney(summary.vault.projected)} by ${fmtDate(window.SP.goal.deadline, 'short')}`} />
      <div className="bento" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <Reveal style={{ gridColumn: 'span 2' }}><VaultProgress go={go} /></Reveal>
        <Reveal delay={60}><CoBudget /></Reveal>
        <Reveal delay={100} style={{ gridColumn: 'span 2' }}><VaultGrowthCard /></Reveal>
        <Reveal delay={140}><CoGaugeCard /></Reveal>
        <Reveal delay={180}><NextPaycheck /></Reveal>
        <Reveal delay={220}><ProjectedSummer /></Reveal>
        <Reveal delay={260}><PaycheckStatus /></Reveal>
        <Reveal delay={300}><AccountsLive go={go} /></Reveal>
        <Reveal delay={340}><RecentExpenses go={go} /></Reveal>
        <Reveal delay={380}><AllocationBreakdown /></Reveal>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
