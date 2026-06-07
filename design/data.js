/* Summer Planner — data modeled on the REAL production app (from live screenshots).
   Editable spreadsheet of 14 paychecks drives everything; allocations cascade into
   Vault / Rent / RH(Robinhood) / CO Spend / BofA buckets. Real accounts track an
   arrival -> now -> projected journey. "Today" = 2026-06-06 (Sat, week of Jun 1-7). */

(function () {
  const TODAY = new Date('2026-06-06T11:30:00');

  const goal = { label: 'Tuition Vault', target: 20000, cap: 20000, deadline: '2026-08-28', term: 'Fall 2026' };

  const employers = {
    USC: { label: 'USC', hue: 235 },
    NTT: { label: 'NTT', hue: 150 },
  };

  // Allocation buckets used by the donut + summaries.
  const buckets = [
    { id: 'vault',  label: 'Vault',     hue: 285, icon: 'target' },
    { id: 'rent',   label: 'Rent',      hue: 35,  icon: 'home'   },
    { id: 'rh',     label: 'Robinhood', hue: 150, icon: 'spark'  },
    { id: 'co',     label: 'CO',        hue: 220, icon: 'wallet' },
    { id: 'buffer', label: 'Buffer',    hue: 330, icon: 'heart'  },
  ];

  // ---- Paychecks (the editable "Paycheck Plan" table) ---------------------
  // Columns mirror production: hours/ot/perDiem/actualNet/extraDeposit are user-editable;
  // grossPay/netPct/vault/rent/rh/co/bofa are computed (values transcribed from the app).
  const P = (n, date, employer, received, hours, ot, perDiem, actualNet, grossPay, extraDeposit, netPct, vault, rent, rh, co, bofa) =>
    ({ id: 'p' + n, n, date, employer, received, hours, ot, perDiem, actualNet, grossPay, extraDeposit, netPct, vault, rent, rh, co, bofa });
  const paychecks = [
    P(1,  '2026-05-27', 'USC', true,  null, 0, 0,   1641.80, 1820, 0,    90.21, 600,  812.25, 200, 0,   0),
    P(2,  '2026-06-05', 'NTT', true,  17,   0, 0,   472.59,  510,  2000, 92.66, 0,    0,      0,   400, 0),
    P(3,  '2026-06-10', 'USC', false, null, 0, 0,   1587.67, 1760, 0,    90.21, 1000, 0,      200, 300, 0),
    P(4,  '2026-06-19', 'NTT', false, 80,   0, 360, 2223.95, 2400, 0,    92.66, 2100, 0,      0,   100, 360),
    P(5,  '2026-06-24', 'USC', false, null, 0, 0,   1587.67, 1760, 0,    90.21, 500,  812.25, 200, 0,   0),
    P(6,  '2026-07-03', 'NTT', false, 80,   0, 300, 2223.95, 2400, 0,    92.66, 2100, 0,      0,   100, 300),
    P(7,  '2026-07-08', 'USC', false, null, 0, 0,   1587.67, 1760, 0,    90.21, 1000, 0,      200, 300, 0),
    P(8,  '2026-07-17', 'NTT', false, 80,   0, 300, 2223.95, 2400, 0,    92.66, 2100, 0,      0,   100, 300),
    P(9,  '2026-07-22', 'USC', false, null, 0, 0,   1587.67, 1760, 0,    90.21, 500,  812.25, 200, 0,   0),
    P(10, '2026-07-31', 'NTT', false, 80,   0, 300, 2223.95, 2400, 0,    92.66, 2100, 0,      0,   100, 300),
    P(11, '2026-08-05', 'USC', false, null, 0, 0,   1587.67, 1760, 0,    90.21, 1000, 0,      200, 300, 0),
    P(12, '2026-08-14', 'NTT', false, 80,   0, 300, 2223.95, 2400, 0,    92.66, 2100, 0,      0,   100, 300),
    P(13, '2026-08-19', 'USC', false, null, 0, 0,   1587.67, 1760, 0,    90.21, 1000, 0,      200, 300, 0),
    P(14, '2026-08-28', 'NTT', false, 80,   0, 300, 2223.95, 2400, 0,    92.66, 1900, 0,      0,   300, 300),
  ];

  // ---- Real accounts (arrival -> now -> projected) ------------------------
  const accounts = [
    { id: 'chase',    name: 'Chase Checking',           tags: ['Checking', 'Paycheck'], kind: 'checking', arrival: 594.39,  now: 1096.53, projected: 3741.80 },
    { id: 'bofa',     name: 'BofA Checking',            tags: ['Checking'],             kind: 'checking', arrival: 2608.30, now: 2608.30, projected: 4468.30 },
    { id: 'hysa',     name: 'Marcus HYSA (Tuition Vault)', tags: ['HYSA', 'Vault'],     kind: 'vault',    arrival: 0,       now: 2600.00, projected: 20000.00, goalTarget: 20000 },
    { id: 'chasecc',  name: 'Chase Credit Card',        tags: ['Credit Card'],          kind: 'credit',   arrival: 51.34,   now: 326.16,  projected: 326.16 },
    { id: 'bofacc',   name: 'BofA Credit Card',         tags: ['Credit Card'],          kind: 'credit',   arrival: 0,       now: 0,       projected: 0 },
  ];
  const netAt = key => accounts.reduce((s, a) => s + (a.kind === 'credit' ? -a[key] : a[key]), 0);
  const accountsSummary = { arrival: netAt('arrival'), now: netAt('now'), projected: netAt('projected') };
  accountsSummary.change = accountsSummary.projected - accountsSummary.arrival;

  // ---- Expenses (CO spending, grouped by week) ----------------------------
  const expenseCats = [
    { id: 'eatingout',     label: 'Eating Out',        hue: 45  },
    { id: 'groceries',     label: 'Groceries',         hue: 150 },
    { id: 'personalcare',  label: 'Personal Care',     hue: 330 },
    { id: 'transport',     label: 'Transport',         hue: 235 },
    { id: 'entertainment', label: 'Entertainment',     hue: 295 },
    { id: 'shopping',      label: 'Shopping',          hue: 20  },
    { id: 'bills',         label: 'Bills & Utilities', hue: 200 },
    { id: 'health',        label: 'Health',            hue: 175 },
    { id: 'subscriptions', label: 'Subscriptions',     hue: 270 },
    { id: 'other',         label: 'Other',             hue: 90  },
  ];
  const expenseAccounts = [
    { id: 'chase',   label: 'Chase Checking' },
    { id: 'chasecc', label: 'Chase CC' },
    { id: 'bofa',    label: 'BofA Checking' },
    { id: 'bofacc',  label: 'BofA CC' },
  ];
  const expenses = [
    { id: 'e1',  date: '2026-06-05', description: 'Godavari Dosa',     category: 'eatingout',     account: 'chasecc', amount: 15.00 },
    { id: 'e2',  date: '2026-06-04', description: 'Chipotle',          category: 'eatingout',     account: 'chasecc', amount: 10.03 },
    { id: 'e3',  date: '2026-06-03', description: 'Cava',              category: 'eatingout',     account: 'chasecc', amount: 12.60 },
    { id: 'e4',  date: '2026-06-03', description: 'Colorado Souvenir', category: 'shopping',      account: 'chasecc', amount: 9.66 },
    { id: 'e5',  date: '2026-06-02', description: 'King Soopers',      category: 'groceries',     account: 'chasecc', amount: 22.42 },
    { id: 'e6',  date: '2026-06-01', description: 'RTD Light Rail',    category: 'transport',     account: 'chasecc', amount: 10.00 },
    { id: 'e7',  date: '2026-05-31', description: 'Snooze A.M.',       category: 'eatingout',     account: 'chasecc', amount: 21.00 },
    { id: 'e8',  date: '2026-05-30', description: 'Target (home setup)', category: 'shopping',     account: 'chasecc', amount: 58.91 },
    { id: 'e9',  date: '2026-05-28', description: 'King Soopers',      category: 'groceries',     account: 'chasecc', amount: 64.20 },
    { id: 'e10', date: '2026-05-27', description: 'Uber from Airport', category: 'transport',     account: 'chasecc', amount: 35.00 },
    { id: 'e11', date: '2026-05-26', description: 'Dazbog Coffee',     category: 'eatingout',     account: 'chasecc', amount: 16.00 },
  ];

  // ---- Cumulative helpers -------------------------------------------------
  const ymd = d => (d instanceof Date ? d.toISOString().slice(0, 10) : d);
  const received = paychecks.filter(p => p.received);
  const pending = paychecks.filter(p => !p.received);

  // vault balance = cumulative (vault allocation + extra deposit)
  const vaultInflow = p => p.vault + p.extraDeposit;
  const sumBy = (list, fn) => list.reduce((s, x) => s + fn(x), 0);

  // ---- Weekly tracker (Mon start, Sun end; from May 26) -------------------
  function buildWeeks() {
    const weeks = [];
    let start = new Date('2026-05-25T12:00:00'); // Monday (Jun 1 is a Monday; weeks end Sunday)
    for (let i = 0; i < 14; i++) {
      const end = new Date(start); end.setDate(end.getDate() + 6); // Sunday
      const sIso = ymd(start), eIso = ymd(end);
      const paysThrough = paychecks.filter(p => p.date <= eIso);
      const cumCO = sumBy(paysThrough, p => p.co);                 // cumulative CO allowance
      const cumVault = sumBy(paysThrough, vaultInflow);            // vault balance by week
      const cumSpent = sumBy(expenses.filter(e => e.date <= eIso), e => e.amount);
      const isCurrent = TODAY >= start && TODAY <= end;
      const status = end < TODAY && !isCurrent ? 'Past' : isCurrent ? 'Current' : 'Future';
      weeks.push({
        n: i + 1, start: sIso, end: eIso,
        startLabel: i === 0 ? 'May 26' : start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        endLabel: end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        budget: cumCO, spent: cumSpent, variance: cumCO - cumSpent, vaultBalance: cumVault,
        status, current: isCurrent,
      });
      start = new Date(end); start.setDate(start.getDate() + 1);
    }
    return weeks;
  }
  const weekly = buildWeeks();
  const currentWeek = weekly.find(w => w.current) || weekly[1];

  // ---- Summary numbers (match the dashboard widgets) ----------------------
  const vaultCurrent = sumBy(received, vaultInflow);               // 2600
  const vaultProjected = sumBy(paychecks, vaultInflow);            // 20000
  const coSpentSummer = sumBy(expenses, e => e.amount);            // 274.82
  const coProjected = sumBy(paychecks, p => p.co);                 // 2400
  const rentPaidProjected = sumBy(paychecks, p => p.rent);         // 2436.75
  const coAllowedNow = currentWeek.budget;                         // 400 cumulative allowed
  const nextPaycheck = pending[0];                                 // Jun 10 USC

  // donut "allocated so far, by bucket" (received only)
  const allocSoFar = {
    vault: sumBy(received, vaultInflow),
    rent: sumBy(received, p => p.rent),
    rh: sumBy(received, p => p.rh),
    co: sumBy(received, p => p.co),
    buffer: 82.54, // computed leftover bucket in app
  };
  const allocTotal = Object.values(allocSoFar).reduce((s, v) => s + v, 0);
  const allocationBreakdown = buckets.map(b => ({
    id: b.id, label: b.label, hue: b.hue,
    amount: allocSoFar[b.id], pct: allocSoFar[b.id] / allocTotal,
  })).sort((a, b) => b.amount - a.amount);

  const summary = {
    vault: { current: vaultCurrent, projected: vaultProjected, cap: goal.cap, pct: vaultCurrent / goal.cap, remaining: goal.cap - vaultCurrent },
    co: {
      spentSummer: coSpentSummer, projectedCO: coProjected, leftSummer: coProjected - coSpentSummer,
      weekRange: `${currentWeek.startLabel} – ${currentWeek.endLabel}`,
      allowedNow: coAllowedNow, leftNow: coAllowedNow - coSpentSummer,
    },
    buffer: { current: 102.14, projected: 747.41 },
    rentPaidProjected,
    paychecks: { received: received.length, pending: pending.length, total: paychecks.length },
    nextPaycheck,
  };

  window.SP = {
    TODAY, goal, employers, buckets, paychecks, received, pending,
    accounts, accountsSummary, expenseCats, expenseAccounts, expenses,
    weekly, currentWeek, allocationBreakdown, summary,
    fmtPaycheckDate: d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
})();
