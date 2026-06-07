/* Summer Planner — Expenses (add form + cumulative CO budget + weekly groups). */

const GREEN = 'var(--pos)';
const GREEN_INK = 'var(--pos-ink)';

function mondayOf(iso) {
  const d = new Date(iso + 'T12:00:00');
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d;
}
function weekKey(iso) { return mondayOf(iso).toISOString().slice(0, 10); }
function weekLabel(iso) {
  const m = mondayOf(iso); const s = new Date(m); const e = new Date(m); e.setDate(e.getDate() + 6);
  const f = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Week of ${f(s)} – ${f(e)}`;
}

function ExpenseToast({ msg, onDone }) {
  React.useEffect(() => { const t = setTimeout(onDone, 2400); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
      background: 'var(--ink-1)', color: 'var(--bg)', padding: '12px 18px', borderRadius: 12, font: '600 13.5px var(--ui)',
      display: 'flex', alignItems: 'center', gap: 9, boxShadow: '0 12px 30px -8px rgba(0,0,0,.4)', animation: 'toastIn .3s cubic-bezier(.22,1,.36,1)' }}>
      <span style={{ width: 20, height: 20, borderRadius: 999, background: 'var(--mint)', display: 'grid', placeItems: 'center' }}><Icon name="check" size={13} color="#fff" /></span>{msg}
    </div>
  );
}

function ExpenseField({ label, children }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ font: '600 11.5px var(--ui)', letterSpacing: '.03em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{label}</span>{children}</label>;
}

function Expenses() {
  const { expenseCats, expenseAccounts, summary } = window.SP;
  const [list, setList] = React.useState(() => window.SP.expenses.slice());
  const [desc, setDesc] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [date, setDate] = React.useState('2026-06-06');
  const [cat, setCat] = React.useState('eatingout');
  const [account, setAccount] = React.useState('chasecc');
  const [toast, setToast] = React.useState(null);
  const [justAdded, setJustAdded] = React.useState(null);

  const catOf = id => expenseCats.find(c => c.id === id);
  const acctOf = id => (expenseAccounts.find(a => a.id === id) || { label: id });
  const valid = parseFloat(amount) > 0 && desc.trim();

  const add = () => {
    if (!valid) return;
    const e = { id: 'e' + Date.now(), date, description: desc.trim(), category: cat, account, amount: parseFloat(amount) };
    setList(prev => [e, ...prev].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)));
    setJustAdded(e.id); setToast(`Added ${fmtMoney(e.amount, { cents: true })} · ${catOf(cat).label}`);
    setDesc(''); setAmount('');
    setTimeout(() => setJustAdded(null), 1200);
  };
  const remove = (id) => setList(prev => prev.filter(e => e.id !== id));

  const spent = list.reduce((s, e) => s + e.amount, 0);
  const leftNow = summary.co.allowedNow - spent;

  // group by week
  const groups = {};
  list.forEach(e => { const k = weekKey(e.date); (groups[k] = groups[k] || []).push(e); });
  const weeks = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Log spend as it happens — grouped by week." />
      {/* add form */}
      <Reveal>
        <div className="card" style={{ padding: 22, marginBottom: 16, borderColor: 'color-mix(in oklch, var(--accent) 32%, var(--hair))' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 14, marginBottom: 14 }}>
            <ExpenseField label="Description"><input className="inp" placeholder="Coffee, gas, etc." value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} /></ExpenseField>
            <ExpenseField label="Amount">
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', font: '600 15px var(--display)' }}>$</span>
                <input className="inp" inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} onKeyDown={e => e.key === 'Enter' && add()} style={{ paddingLeft: 25 }} />
              </div>
            </ExpenseField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <ExpenseField label="Date"><input className="inp" type="date" value={date} onChange={e => setDate(e.target.value)} /></ExpenseField>
            <ExpenseField label="Category">
              <select className="sel" value={cat} onChange={e => setCat(e.target.value)}>{expenseCats.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
            </ExpenseField>
            <ExpenseField label="Account">
              <select className="sel" value={account} onChange={e => setAccount(e.target.value)}>{expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
            </ExpenseField>
          </div>
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 7, marginBottom: 16, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
            {expenseCats.map(c => (
              <button key={c.id} onClick={() => setCat(c.id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 999, cursor: 'pointer', font: '600 11.5px var(--ui)', whiteSpace: 'nowrap', flex: 'none',
                border: '1px solid', borderColor: cat === c.id ? `oklch(0.6 0.14 ${c.hue})` : 'var(--hair)',
                background: cat === c.id ? `color-mix(in oklch, oklch(0.68 0.14 ${c.hue}) 16%, transparent)` : 'var(--surface)',
                color: cat === c.id ? `oklch(0.5 0.14 ${c.hue})` : 'var(--ink-2)', transition: 'all .15s' }}>
                <CatDot hue={c.hue} size={8} />{c.label}
              </button>
            ))}
          </div>
          <button className="btn-primary" disabled={!valid} onClick={add} style={{ width: '100%', justifyContent: 'center', opacity: valid ? 1 : 0.5, cursor: valid ? 'pointer' : 'not-allowed' }}>
            <Icon name="plus" size={16} /> Add expense
          </button>
        </div>
      </Reveal>

      {/* CO budget bar */}
      <Reveal delay={60}>
        <div className="card" style={{ padding: '16px 20px', marginBottom: 18, borderLeft: `4px solid ${GREEN}`, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ font: '600 26px/1 var(--display)', letterSpacing: '-.02em', color: GREEN_INK }}><Money value={leftNow} cents dur={900} /></span>
          <span style={{ font: '500 14px var(--ui)', color: 'var(--ink-2)' }}>left to spend overall</span>
          <span style={{ marginLeft: 'auto', font: '500 12.5px var(--ui)', color: 'var(--ink-3)' }}>Spent {fmtMoney(spent, { cents: true })} · Maximum allowed {fmtMoney(summary.co.allowedNow, { cents: true })}</span>
        </div>
      </Reveal>

      {/* charts */}
      <ExpenseCharts list={list} cats={expenseCats} />

      {/* weekly groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {weeks.map((wk, wi) => {
          const items = groups[wk].slice().sort((a, b) => b.date.localeCompare(a.date));
          const total = items.reduce((s, e) => s + e.amount, 0);
          return (
            <Reveal key={wk} delay={100 + wi * 40}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 2px' }}>
                  <span style={{ font: '600 14px var(--ui)', color: 'var(--ink-1)' }}>{weekLabel(wk)}</span>
                  <span style={{ font: '600 14px var(--display)', color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(total, { cents: true })}</span>
                </div>
                <div className="card" style={{ padding: '4px 16px' }}>
                  {items.map((e, i) => {
                    const c = catOf(e.category);
                    return (
                      <div key={e.id} className="exp-row" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 4px', borderTop: i ? '1px solid var(--hair)' : 'none',
                        background: justAdded === e.id ? `color-mix(in oklch, oklch(0.68 0.14 ${c.hue}) 13%, transparent)` : 'transparent', borderRadius: justAdded === e.id ? 10 : 0, transition: 'background 1s ease' }}>
                        <span style={{ width: 52, flex: 'none', font: '500 11.5px var(--ui)', color: 'var(--ink-3)', lineHeight: 1.3 }}>{new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ font: '600 14.5px var(--ui)', color: 'var(--ink-1)' }}>{e.description}</div>
                          <div style={{ display: 'flex', gap: 7, marginTop: 5 }}>
                            <span style={{ font: '600 11px var(--ui)', padding: '2px 8px', borderRadius: 6, background: `color-mix(in oklch, oklch(0.68 0.14 ${c.hue}) 16%, transparent)`, color: `oklch(0.5 0.14 ${c.hue})` }}>{c.label}</span>
                            <span style={{ font: '600 11px var(--ui)', padding: '2px 8px', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{acctOf(e.account).label}</span>
                          </div>
                        </div>
                        <span style={{ font: '600 15px var(--display)', color: 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(e.amount, { cents: true })}</span>
                        <button className="trash-btn" onClick={() => remove(e.id)} aria-label="delete"><Icon name="trash" size={16} color="var(--ink-4)" /></button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
      {toast && <ExpenseToast msg={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

function ExpenseCharts({ list, cats }) {
  const byCat = cats.map(c => ({ label: c.label, hue: c.hue, total: list.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0) })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  const catTotal = byCat.reduce((s, c) => s + c.total, 0) || 1;
  const wk = {}; list.forEach(e => { const k = weekKey(e.date); wk[k] = (wk[k] || 0) + e.amount; });
  const bars = Object.keys(wk).sort().map(k => ({ label: new Date(k + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: wk[k], color: 'var(--accent)' }));
  if (!byCat.length) return null;
  return (
    <div className="dash-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16, marginBottom: 18 }}>
      <Reveal from="left">
        <div className="card" style={{ padding: 20, height: '100%' }}>
          <SectionLabel>By category</SectionLabel>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <Donut data={byCat} size={140} stroke={20} />
            <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {byCat.map(c => (
                <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CatDot hue={c.hue} /><span style={{ flex: 1, font: '500 12.5px var(--ui)', color: 'var(--ink-2)' }}>{c.label}</span>
                  <span style={{ font: '600 12.5px var(--display)', color: 'var(--ink-1)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(c.total / catTotal * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
      <Reveal from="right">
        <div className="card" style={{ padding: 20, height: '100%' }}>
          <SectionLabel right={<span style={{ font: '500 12px var(--ui)', color: 'var(--ink-3)' }}>per week</span>}>Spending by week</SectionLabel>
          <BarChart bars={bars} height={190} formatTop={v => '$' + v.toFixed(0)} />
        </div>
      </Reveal>
    </div>
  );
}

window.Expenses = Expenses;
