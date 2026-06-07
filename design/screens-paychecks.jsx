/* Summer Planner — Paychecks ("Paycheck Plan" editable table + summary cards). */

function SummaryStat({ label, value, tag, sub, hue }) {
  return (
    <div className="card" style={{ padding: 18, height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ font: '600 12px var(--ui)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{label}</span>
        {tag && <span style={{ font: '600 10px var(--ui)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-4)', border: '1px solid var(--hair)', borderRadius: 6, padding: '2px 7px' }}>{tag}</span>}
      </div>
      <div style={{ font: '600 28px/1 var(--display)', letterSpacing: '-.02em', color: hue != null ? `oklch(0.6 0.16 ${hue})` : 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ font: '500 12px var(--ui)', color: 'var(--ink-3)', marginTop: 7 }}>{sub}</div>}
    </div>
  );
}

function EmployerBadge({ employer }) {
  const hue = window.SP.employers[employer].hue;
  return <span style={{ font: '600 11px var(--ui)', padding: '3px 9px', borderRadius: 7, background: `color-mix(in oklch, oklch(0.62 0.16 ${hue}) 16%, transparent)`, color: `oklch(0.5 0.16 ${hue})` }}>{employer}</span>;
}

function Paychecks() {
  const [rows, setRows] = React.useState(() => window.SP.paychecks.map(p => ({ ...p })));
  const edit = (id, field, raw) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: raw } : r));
  };
  const toggle = (id) => setRows(rs => rs.map(r => r.id === id ? { ...r, received: !r.received } : r));

  const sum = f => rows.reduce((s, r) => s + (parseFloat(r[f]) || 0), 0);
  const vaultInflow = r => (parseFloat(r.vault) || 0) + (parseFloat(r.extraDeposit) || 0);
  const received = rows.filter(r => r.received);
  const vaultCurrent = received.reduce((s, r) => s + vaultInflow(r), 0);
  const vaultProjected = rows.reduce((s, r) => s + vaultInflow(r), 0);
  const coProjected = sum('co');
  const coAllocatedNow = received.reduce((s, r) => s + (parseFloat(r.co) || 0), 0);
  const pct = vaultCurrent / window.SP.goal.cap;

  const COLS = [
    { k: 'num', label: '#', w: 34, align: 'left' },
    { k: 'date', label: 'Pay Date', w: 78, align: 'left' },
    { k: 'employer', label: 'Employer', w: 78, align: 'left' },
    { k: 'received', label: 'Received', w: 70, align: 'center' },
    { k: 'hours', label: 'Hours', w: 58, align: 'center', editable: true },
    { k: 'ot', label: 'OT', w: 42, align: 'center', editable: true },
    { k: 'perDiem', label: 'Per Diem', w: 64, align: 'center', editable: true },
    { k: 'actualNet', label: 'Actual Net', w: 104, align: 'center', editable: true, strong: true },
    { k: 'grossPay', label: 'Gross Pay', w: 80, align: 'right', money: true, muted: true },
    { k: 'extraDeposit', label: 'Extra Dep.', w: 78, align: 'center', editable: true },
    { k: 'netPct', label: 'Net %', w: 60, align: 'right', muted: true, pct: true },
    { k: 'vault', label: 'Vault', w: 76, align: 'right', money: true, hue: 285 },
    { k: 'rent', label: 'Rent', w: 76, align: 'right', money: true, hue: 35 },
    { k: 'rh', label: 'RH', w: 66, align: 'right', money: true, hue: 150 },
    { k: 'co', label: 'CO Spend', w: 80, align: 'right', money: true, hue: 220 },
    { k: 'bofa', label: 'BofA', w: 72, align: 'right', money: true, hue: 330 },
  ];

  return (
    <div>
      <PageHeader title="Paycheck Plan" subtitle="Edit hours, per diem, and actual net as paychecks arrive — computed columns update live." />
      <Reveal>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="plan-table" style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1020, tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  {COLS.map(c => (
                    <th key={c.k} style={{ textAlign: c.align, padding: '12px 8px', font: '600 10.5px var(--ui)', letterSpacing: '.03em', textTransform: 'uppercase', color: 'var(--ink-3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--hair)', position: 'sticky', top: 0, background: 'var(--surface)' }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="plan-row" style={{ background: r.received ? 'color-mix(in oklch, var(--mint) 6%, transparent)' : 'transparent' }}>
                    {COLS.map(c => (
                      <td key={c.k} style={{ padding: '7px 8px', textAlign: c.align, borderBottom: i < rows.length - 1 ? '1px solid var(--hair)' : 'none', whiteSpace: 'nowrap' }}>
                        {renderCell(c, r, edit, toggle)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
      <Reveal delay={80}>
        <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginTop: 16 }}>
          <SummaryStat label="Total Vault" tag="Current" value={fmtMoney(vaultCurrent, { cents: true })} sub={`Projected ${fmtMoney(vaultProjected)}`} hue={285} />
          <SummaryStat label="Summer CO Budget" tag="Projected" value={fmtMoney(coProjected, { cents: true })} sub={`Allocated ${fmtMoney(coAllocatedNow)} so far`} hue={220} />
          <SummaryStat label="Total Buffer" tag="Current" value={fmtMoney(window.SP.summary.buffer.current, { cents: true })} sub={`Projected ${fmtMoney(window.SP.summary.buffer.projected)}`} hue={330} />
          <SummaryStat label="Vault Progress" tag="Current" value={`${(pct * 100).toFixed(1)}%`} sub={`${fmtMoney(vaultCurrent)} of ${fmtMoney(window.SP.goal.cap)}`} hue={45} />
        </div>
      </Reveal>
      <PaycheckCharts />
    </div>
  );
}

function PaycheckCharts() {
  const { paychecks, employers, goal } = window.SP;
  const fd = d => window.SP.fmtPaycheckDate(d);
  const alloc = paychecks.map(p => ({ label: fd(p.date), segments: [
    { value: p.vault + p.extraDeposit, hue: 285 }, { value: p.rent, hue: 35 }, { value: p.rh, hue: 150 }, { value: p.co, hue: 220 }, { value: p.bofa, hue: 330 },
  ] }));
  const empTotals = Object.keys(employers).map(k => ({ label: k, hue: employers[k].hue, total: paychecks.filter(p => p.employer === k).reduce((s, p) => s + p.actualNet, 0) }));
  const totalIncome = paychecks.reduce((s, p) => s + p.actualNet, 0);
  const collected = paychecks.filter(p => p.received).reduce((s, p) => s + p.actualNet, 0);
  const legend = [['Vault', 285], ['Rent', 35], ['RH', 150], ['CO', 220], ['BofA', 330]];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
      <Reveal>
        <div className="card" style={{ padding: 22 }}>
          <SectionLabel right={<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{legend.map(([l, h]) => <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: '500 11.5px var(--ui)', color: 'var(--ink-3)' }}><CatDot hue={h} />{l}</span>)}</div>}>Allocation per paycheck</SectionLabel>
          <StackedBars data={alloc} height={210} formatTop={v => '$' + (v / 1000).toFixed(1) + 'k'} />
        </div>
      </Reveal>
      <div className="dash-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Reveal from="left">
          <div className="card" style={{ padding: 22, height: '100%' }}>
            <SectionLabel right={<span style={{ font: '500 12px var(--ui)', color: 'var(--ink-3)' }}>{fmtMoney(totalIncome)} total</span>}>Net income by employer</SectionLabel>
            <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
              <Donut data={empTotals} size={150} stroke={24} />
              <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {empTotals.map(e => (
                  <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CatDot hue={e.hue} /><span style={{ flex: 1, font: '600 14px var(--ui)', color: 'var(--ink-1)' }}>{e.label}</span>
                    <span style={{ font: '600 14px var(--display)', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(e.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal from="right">
          <div className="card" style={{ padding: 22, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <SectionLabel right={<span style={{ font: '500 12px var(--ui)', color: 'var(--pos-ink)' }}>{Math.round(collected / totalIncome * 100)}% collected</span>}>Income collected so far</SectionLabel>
            <div style={{ flex: 1, display: 'grid', placeItems: 'center', paddingBottom: 6 }}>
              <GaugeArc value={collected / totalIncome} size={220} stroke={18} gradient={['var(--pos)', 'var(--accent)']} glow="color-mix(in oklch, var(--pos) 40%, transparent)">
                <div style={{ textAlign: 'center', paddingBottom: 4 }}>
                  <div style={{ font: '600 28px var(--display)', letterSpacing: '-.02em', color: 'var(--ink-1)' }}>{fmtMoney(collected)}</div>
                  <div style={{ font: '500 12px var(--ui)', color: 'var(--ink-3)' }}>of {fmtMoney(totalIncome)} summer income</div>
                </div>
              </GaugeArc>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function renderCell(c, r, edit, toggle) {
  const v = r[c.k];
  if (c.k === 'num') return <span style={{ font: '600 12px var(--display)', color: 'var(--ink-4)' }}>{r.n}</span>;
  if (c.k === 'date') return <span style={{ font: '600 13px var(--ui)', color: 'var(--ink-1)' }}>{window.SP.fmtPaycheckDate(r.date)}</span>;
  if (c.k === 'employer') return <EmployerBadge employer={r.employer} />;
  if (c.k === 'received') return (
    <button onClick={() => toggle(r.id)} aria-label="received" style={{ width: 22, height: 22, borderRadius: 7, cursor: 'pointer', display: 'grid', placeItems: 'center',
      border: '1.5px solid', borderColor: r.received ? 'var(--mint)' : 'var(--ink-4)', background: r.received ? 'var(--mint)' : 'transparent', transition: 'all .15s' }}>
      {r.received && <Icon name="check" size={13} color="#fff" stroke={2.6} />}
    </button>
  );
  if (c.editable) return (
    <input className="cell-inp" value={v == null ? '' : v} placeholder="0"
      onChange={e => edit(r.id, c.k, e.target.value.replace(/[^0-9.]/g, ''))}
      style={{ width: '100%', maxWidth: c.w, textAlign: 'center', fontWeight: c.strong ? 600 : 500 }} />
  );
  if (c.pct) return <span style={{ font: '500 12.5px var(--ui)', color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{(parseFloat(v) || 0).toFixed(2)}%</span>;
  if (c.money) {
    const num = parseFloat(v) || 0;
    const color = c.muted ? 'var(--ink-3)' : (c.hue != null && num > 0 ? `oklch(0.55 0.14 ${c.hue})` : 'var(--ink-2)');
    return <span style={{ font: `${c.muted ? 500 : 600} 13px var(--display)`, color, fontVariantNumeric: 'tabular-nums' }}>{num > 0 ? fmtMoney(num, { cents: true }) : '—'}</span>;
  }
  return <span>{v}</span>;
}

window.Paychecks = Paychecks;
