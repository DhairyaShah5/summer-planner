/* Summer Planner — Accounts (arrival→now→projected), Weekly tracker, Settings. */

const GREEN = 'var(--pos)';
const GREEN_INK = 'var(--pos-ink)';

/* ===== ACCOUNTS ========================================================== */
function NetCard({ label, sub, value, accent, big }) {
  return (
    <div className="card" style={{ padding: 20, height: '100%', borderColor: accent ? `color-mix(in oklch, ${GREEN} 40%, var(--hair))` : 'var(--hair)', background: accent ? `color-mix(in oklch, ${GREEN} 7%, var(--surface))` : 'var(--surface)' }}>
      <div style={{ font: '600 11px var(--ui)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
      <div style={{ font: '500 12.5px var(--ui)', color: 'var(--ink-3)', marginBottom: 12 }}>{sub}</div>
      <div style={{ font: `600 ${big ? 34 : 30}px/1 var(--display)`, letterSpacing: '-.02em', color: accent ? GREEN_INK : 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }}>
        <Money value={value} cents dur={1300} />
      </div>
    </div>
  );
}

function AccountCard({ a }) {
  const isCredit = a.kind === 'credit';
  const delta = a.projected - a.now;
  const tagColor = t => (t === 'Vault' || t === 'HYSA') ? 285 : t === 'Credit Card' ? 25 : t === 'Paycheck' ? 150 : 235;
  return (
    <div className="card" style={{ padding: '18px 24px' }}>
      <div className="acct-row" style={{ gridTemplateColumns: isCredit ? 'minmax(220px,1.6fr) 1fr 1fr auto' : 'minmax(220px,1.5fr) 1fr 1fr 1fr auto' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ font: '600 16px var(--ui)', color: 'var(--ink-1)' }}>{a.name}</span>
            {a.tags.map(t => (
              <span key={t} style={{ font: '600 11px var(--ui)', padding: '2px 8px', borderRadius: 6, background: `color-mix(in oklch, oklch(0.62 0.16 ${tagColor(t)}) 16%, transparent)`, color: `oklch(0.5 0.16 ${tagColor(t)})` }}>{t}</span>
            ))}
          </div>
          {isCredit && <div style={{ font: '500 12px var(--ui)', color: 'var(--ink-4)', marginTop: 6 }}>Outstanding balance</div>}
          {a.goalTarget && (
            <div style={{ marginTop: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 11.5px var(--ui)', color: 'var(--ink-3)', marginBottom: 6 }}>
                <span style={{ color: 'var(--accent-ink)', fontWeight: 600 }}>{(a.now / a.goalTarget * 100).toFixed(1)}% funded</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(a.now)} / {fmtMoney(a.goalTarget)}</span>
              </div>
              <ProgressBar pct={a.now / a.goalTarget} />
            </div>
          )}
        </div>
        <Stage label="At arrival" value={a.arrival} />
        <Stage label="Right now" value={a.now} big credit={isCredit} />
        {!isCredit && <Stage label="Projected end" value={a.projected} delta={delta} />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifySelf: 'end' }}>
          {isCredit && <button className="ghost-btn"><Icon name="card" size={15} /> Pay credit card</button>}
          <button className="icon-btn" style={{ width: 32, height: 32 }} aria-label="edit"><Icon name="pencil" size={15} color="var(--ink-3)" /></button>
        </div>
      </div>
    </div>
  );
}
function Stage({ label, value, big, delta, credit }) {
  return (
    <div>
      <div style={{ font: '600 10.5px var(--ui)', letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 5 }}>{label}</div>
      <div style={{ font: `600 ${big ? 24 : 16}px var(--display)`, letterSpacing: big ? '-.02em' : 0, color: credit ? 'var(--accent-ink)' : (big ? 'var(--ink-1)' : 'var(--ink-2)'), fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(value, { cents: true })}</div>
      {delta != null && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 5, font: '600 11.5px var(--ui)', color: delta > 0 ? GREEN_INK : 'var(--ink-4)' }}><Icon name="arrowUp" size={12} /> {delta > 0 ? '+' : ''}{fmtMoney(delta)} from now</div>}
    </div>
  );
}

function Accounts() {
  const { accounts, accountsSummary } = window.SP;
  return (
    <div>
      <PageHeader title="Accounts" subtitle="Live balances derived from paychecks + expenses. Arrival balances anchor the math." />
      <div className="net-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        <Reveal><NetCard label="At arrival" sub="Came to Colorado with" value={accountsSummary.arrival} /></Reveal>
        <Reveal delay={50}><NetCard label="Right now" sub="Live net worth today" value={accountsSummary.now} big /></Reveal>
        <Reveal delay={100}><NetCard label="Leaving with (projected)" sub="Net worth at summer's end" value={accountsSummary.projected} accent /></Reveal>
      </div>
      <div style={{ textAlign: 'center', margin: '16px 0 4px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: '600 14px var(--ui)', color: GREEN_INK, whiteSpace: 'nowrap' }}>
          <Icon name="trend" size={16} /> Net change over the summer: +{fmtMoney(accountsSummary.change, { cents: true })}
        </span>
      </div>
      <AccountsCharts />
      <SectionLabel>Per account · journey from arrival to projected end</SectionLabel>
      <div className="accounts-journey" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {accounts.map((a, i) => <Reveal key={a.id} delay={i * 50}><AccountCard a={a} /></Reveal>)}
      </div>
    </div>
  );
}

function AccountsCharts() {
  const { accounts } = window.SP;
  const hueOf = { chase: 235, bofa: 200, hysa: 285 };
  const assets = accounts.filter(a => a.kind !== 'credit');
  const comp = assets.map(a => ({ label: a.name, hue: hueOf[a.id] || 235, total: a.now }));
  const total = comp.reduce((s, c) => s + c.total, 0) || 1;
  return (
    <Reveal>
      <div className="card" style={{ padding: 22, marginBottom: 18 }}>
        <SectionLabel right={<span style={{ font: '500 12px var(--ui)', color: 'var(--ink-3)' }}>{fmtMoney(total)} in assets</span>}>Composition right now</SectionLabel>
        <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
          <Donut data={comp} size={170} stroke={26} />
          <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comp.map(c => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <CatDot hue={c.hue} />
                <span style={{ flex: 1, font: '600 13.5px var(--ui)', color: 'var(--ink-1)' }}>{c.label}</span>
                <span style={{ font: '600 13.5px var(--display)', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(c.total, { cents: true })}</span>
                <span style={{ width: 42, textAlign: 'right', font: '500 12.5px var(--ui)', color: 'var(--ink-3)' }}>{Math.round(c.total / total * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ===== WEEKLY ============================================================ */
function Weekly() {
  const { weekly, summary } = window.SP;
  const series = [
    { name: 'Spending Budget', color: 'var(--ink-2)', fill: false, points: weekly.map((w, i) => ({ x: i % 2 === 0 ? w.endLabel : '', y: w.budget })) },
    { name: 'Actual Spent', color: 'var(--accent)', fill: true, points: weekly.map((w, i) => ({ x: i % 2 === 0 ? w.endLabel : '', y: w.spent })) },
  ];
  return (
    <div>
      <PageHeader title="Weekly Tracker" subtitle="Maximum allowed to spend (cumulative) vs actual spent · week ending Sunday." />
      <Reveal>
        <div className="card" style={{ padding: '16px 20px', marginBottom: 18, borderLeft: `4px solid ${GREEN}`, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ font: '600 26px/1 var(--display)', letterSpacing: '-.02em', color: GREEN_INK }}><Money value={summary.co.leftSummer} cents dur={900} /></span>
          <span style={{ font: '500 14px var(--ui)', color: 'var(--ink-2)' }}>left to spend this summer</span>
          <span style={{ marginLeft: 'auto', font: '500 12.5px var(--ui)', color: 'var(--ink-3)' }}>Spent {fmtMoney(summary.co.spentSummer, { cents: true })} of {fmtMoney(summary.co.projectedCO, { cents: true })} projected CO</span>
        </div>
      </Reveal>
      <Reveal delay={60}>
        <div className="card" style={{ padding: 22, marginBottom: 18 }}>
          <SectionLabel right={<div style={{ display: 'flex', gap: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 12px var(--ui)', color: 'var(--ink-3)' }}><span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--accent)' }} />Actual spent</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '500 12px var(--ui)', color: 'var(--ink-3)' }}><span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--ink-2)' }} />Spending budget</span>
          </div>}>Spending vs Budget</SectionLabel>
          <AreaChart series={series} width={720} height={250} />
        </div>
      </Reveal>
      <Reveal delay={120}>
        <div className="card" style={{ padding: 22 }}>
          <SectionLabel>Weekly Breakdown</SectionLabel>
          <div style={{ overflowX: 'auto' }}>
            <table className="plan-table" style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
              <thead><tr>
                {['Week', 'Start', 'End', 'Spending Budget', 'Actual Spent', 'Variance', 'Vault Balance', 'Status'].map((h, i) => (
                  <th key={h} style={{ textAlign: i > 2 ? 'right' : 'left', padding: '11px 14px', font: '600 11px var(--ui)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--hair)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {weekly.map((w, i) => (
                  <tr key={w.n} className="plan-row" style={{ background: w.current ? 'color-mix(in oklch, var(--accent) 7%, transparent)' : 'transparent' }}>
                    <td style={tdS(i, weekly.length, 'left')}><span style={{ font: '600 13px var(--display)', color: 'var(--ink-2)' }}>{w.n}</span></td>
                    <td style={tdS(i, weekly.length, 'left')}><span style={{ font: '500 13px var(--ui)', color: 'var(--ink-2)' }}>{w.startLabel}</span></td>
                    <td style={tdS(i, weekly.length, 'left')}><span style={{ font: '500 13px var(--ui)', color: 'var(--ink-2)' }}>{w.endLabel}</span></td>
                    <td style={tdS(i, weekly.length, 'right')}><span style={mono()}>{fmtMoney(w.budget, { cents: true })}</span></td>
                    <td style={tdS(i, weekly.length, 'right')}><span style={mono()}>{fmtMoney(w.spent, { cents: true })}</span></td>
                    <td style={tdS(i, weekly.length, 'right')}><span style={{ ...mono(), color: w.variance < 0 ? 'var(--accent-ink)' : GREEN_INK }}>{w.variance < 0 ? '−' : ''}{fmtMoney(Math.abs(w.variance), { cents: true })}</span></td>
                    <td style={tdS(i, weekly.length, 'right')}><span style={mono()}>{fmtMoney(w.vaultBalance, { cents: true })}</span></td>
                    <td style={tdS(i, weekly.length, 'right')}><WeekStatus s={w.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
function tdS(i, len, align) { return { padding: '11px 14px', textAlign: align, borderBottom: i < len - 1 ? '1px solid var(--hair)' : 'none', whiteSpace: 'nowrap' }; }
function mono() { return { font: '600 13px var(--display)', color: 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }; }
function WeekStatus({ s }) {
  const map = { Past: { bg: 'var(--surface-2)', fg: 'var(--ink-3)' }, Current: { bg: 'color-mix(in oklch, var(--accent) 16%, transparent)', fg: 'var(--accent-ink)' }, Future: { bg: 'color-mix(in oklch, var(--gold) 18%, transparent)', fg: 'color-mix(in oklch, var(--gold) 70%, var(--ink-1))' } };
  const t = map[s] || map.Past;
  return <span style={{ font: '600 11px var(--ui)', padding: '3px 10px', borderRadius: 999, background: t.bg, color: t.fg }}>{s}</span>;
}

/* ===== SETTINGS ========================================================== */
function Settings() {
  const { goal, buckets, employers, paychecks } = window.SP;
  const [target, setTarget] = React.useState(goal.target);
  const [deadline, setDeadline] = React.useState(goal.deadline);
  const empList = Object.keys(employers).map(k => {
    const rows = paychecks.filter(p => p.employer === k);
    return { k, hue: employers[k].hue, count: rows.length, netPct: rows[0] ? rows[0].netPct : null };
  });
  return (
    <div>
      <PageHeader title="Settings" subtitle="Goal, employers, and how each paycheck cascades into buckets." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Reveal>
            <div className="card" style={{ padding: 22, height: '100%' }}>
              <SectionLabel>Tuition goal</SectionLabel>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SField label="Vault target"><MoneyInput value={target} onChange={setTarget} /></SField>
                <SField label="Deadline"><input className="inp" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></SField>
              </div>
              <div style={{ marginTop: 12, padding: '11px 14px', borderRadius: 12, background: 'var(--surface-2)', font: '500 13px var(--ui)', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon name="flag" size={14} color="var(--accent)" /> {goal.term} · {fmtMoney(target)} by {fmtDate(deadline, 'short')}
              </div>
            </div>
          </Reveal>
          <Reveal delay={50}>
            <div className="card" style={{ padding: 22, height: '100%' }}>
              <SectionLabel>Employers</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {empList.map(e => (
                  <div key={e.k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 11, background: 'var(--surface-2)' }}>
                    <span style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', font: '600 13px var(--display)', color: '#fff', background: `oklch(0.6 0.16 ${e.hue})` }}>{e.k}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ font: '600 14px var(--ui)', color: 'var(--ink-1)' }}>{e.k}</div>
                      <div style={{ font: '500 12px var(--ui)', color: 'var(--ink-3)' }}>{e.count} paychecks{e.netPct ? ` · ${e.netPct}% net` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
        <Reveal delay={100}>
          <div className="card" style={{ padding: 22 }}>
            <SectionLabel right={<span style={{ font: '500 12px var(--ui)', color: 'var(--ink-3)' }}>Per diem → CO · Hourly → Vault</span>}>Allocation buckets</SectionLabel>
            <div className="cascade-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
              {buckets.map((b, i) => (
                <div key={b.id} style={{ padding: 16, borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--hair)', display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <AccountGlyph hue={b.hue} icon={b.icon} size={34} />
                    <span style={{ font: '600 12px var(--display)', color: 'var(--ink-4)' }}>{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <div style={{ font: '600 14px var(--ui)', color: 'var(--ink-1)' }}>{b.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
function SField({ label, children }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ font: '600 11.5px var(--ui)', letterSpacing: '.03em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{label}</span>{children}</label>;
}
function MoneyInput({ value, onChange }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', font: '600 15px var(--display)' }}>$</span>
      <input className="inp" inputMode="numeric" value={value.toLocaleString('en-US')} onChange={e => onChange(parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0)} style={{ paddingLeft: 24, fontVariantNumeric: 'tabular-nums' }} />
    </div>
  );
}

Object.assign(window, { Accounts, Weekly, Settings });
