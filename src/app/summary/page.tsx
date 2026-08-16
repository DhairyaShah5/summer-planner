import { getViewerContext } from '@/lib/viewer-context'
import {
  computeAccountStates,
  computeAll,
  mondaysBetween,
  defaultRentDate,
  RH_WEEKLY_CUTOVER,
  INTERNSHIP_END,
  CO_SURPLUS_SWEEP_KINDS,
  type AccountEntryInput,
  type AccountInput,
  type CCPaymentInput,
  type Employer,
  type ExpenseInput,
  type PaycheckInput,
  type Settings,
  type TransferInput,
} from '@/lib/calc'
import { todayInUserTz } from '@/lib/today'
import { PageHeader, SectionLabel, fmtMoney, Reveal } from '@/components/redesign'

export const dynamic = 'force-dynamic'

type Row = { label: string; amount: number; note?: string }

export default async function SummaryPage() {
  const { supabase } = await getViewerContext()
  const today = todayInUserTz()

  const [
    accountsRes,
    settingsRes,
    paychecksRes,
    expensesRes,
    ccPaymentsRes,
    transfersRes,
    accountEntriesRes,
  ] = await Promise.all([
    supabase.from('accounts').select('*').order('display_order', { ascending: true }),
    supabase.from('settings').select('*').maybeSingle(),
    supabase.from('paychecks').select('*').order('pay_num', { ascending: true }),
    supabase
      .from('expenses')
      .select('id, expense_date, amount, account_id, refund_expected, refund_settled'),
    supabase.from('cc_payments').select('*'),
    supabase
      .from('transfers')
      .select('id, transferred_at, from_account_id, to_account_id, amount, kind'),
    supabase
      .from('account_entries')
      .select('id, account_id, dated_at, amount, description'),
  ])

  if (accountsRes.error) throw accountsRes.error
  if (settingsRes.error) throw settingsRes.error
  if (paychecksRes.error) throw paychecksRes.error
  if (expensesRes.error) throw expensesRes.error
  if (ccPaymentsRes.error) throw ccPaymentsRes.error
  if (transfersRes.error) throw transfersRes.error
  if (accountEntriesRes.error) throw accountEntriesRes.error

  const s = settingsRes.data
  const settings: Settings = s
    ? {
        vaultCap: Number(s.vault_cap),
        uscGrossBaseline: Number(s.usc_gross_baseline),
        nttHourlyRate: Number(s.ntt_hourly_rate),
        uscNetPct: Number(s.usc_net_pct),
        nttNetPct: Number(s.ntt_net_pct),
        rentMonthly: Number(s.rent_monthly),
        rentMonths: Number(s.rent_months),
        robinhoodWeekly: Number(s.robinhood_weekly),
        uscNoRentVault: Number(s.usc_no_rent_vault),
        uscRentVault: Number(s.usc_rent_vault),
        nttVaultDefault: Number(s.ntt_vault_default),
      }
    : {
        vaultCap: 0, uscGrossBaseline: 0, nttHourlyRate: 0, uscNetPct: 0,
        nttNetPct: 0, rentMonthly: 0, rentMonths: 0, robinhoodWeekly: 0,
        uscNoRentVault: 0, uscRentVault: 0, nttVaultDefault: 0,
      }

  const accounts: AccountInput[] = (accountsRes.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as AccountInput['type'],
    arrival_balance: Number(a.arrival_balance),
    is_paycheck_destination: a.is_paycheck_destination,
    is_vault: a.is_vault,
    display_order: a.display_order,
  }))

  const paychecks: PaycheckInput[] = (paychecksRes.data ?? []).map((p) => {
    const ov = (p.flow_overrides as Record<string, string> | null) ?? {}
    return {
      payNum: p.pay_num,
      payDate: p.pay_date,
      employer: p.employer as Employer,
      hoursWorked: p.hours_worked,
      otHours: p.ot_hours,
      actualNetWages: p.actual_net_wages,
      perDiem: p.per_diem,
      reimbursement: p.reimbursement,
      extraDeposit: p.extra_deposit,
      vaultOverride: p.vault_override,
      grossOverride: p.gross_override,
      rentPaid: p.rent_paid,
      rentDateOverride: ov.rent ?? null,
      rentAmountOverride: ov.rent_amount != null ? Number(ov.rent_amount) : null,
      coOverride: ov.co_amount != null ? Number(ov.co_amount) : null,
      bofaOverride: ov.bofa_overflow != null ? Number(ov.bofa_overflow) : null,
      robinhoodOverride: ov.robinhood_amount != null ? Number(ov.robinhood_amount) : null,
      received: p.received,
    }
  })

  const expenses: ExpenseInput[] = (expensesRes.data ?? []).map((e) => ({
    id: e.id,
    expense_date: e.expense_date,
    amount: Number(e.amount),
    account_id: e.account_id,
    refund_expected: e.refund_expected != null ? Number(e.refund_expected) : null,
    refund_settled: e.refund_settled ?? false,
  }))

  const ccPayments: CCPaymentInput[] = (ccPaymentsRes.data ?? []).map((p) => ({
    id: p.id,
    paid_at: p.paid_at,
    from_account_id: p.from_account_id,
    to_account_id: p.to_account_id,
    amount: Number(p.amount),
    kind: p.kind ?? 'payment',
  }))

  const transfers: TransferInput[] = (transfersRes.data ?? []).map((t) => ({
    id: t.id,
    transferred_at: t.transferred_at,
    from_account_id: t.from_account_id,
    to_account_id: t.to_account_id,
    amount: Number(t.amount),
    kind: t.kind,
  }))

  const accountEntries: AccountEntryInput[] = (accountEntriesRes.data ?? []).map((e) => ({
    id: e.id,
    account_id: e.account_id,
    dated_at: e.dated_at,
    amount: Number(e.amount),
    description: e.description,
  }))

  // --- Arrival net worth: cash accounts positive, CC balances flipped. ---
  let arrivalNetWorth = 0
  for (const a of accounts) {
    arrivalNetWorth += a.type === 'credit_card' ? -a.arrival_balance : a.arrival_balance
  }

  // --- Paycheck rows (seeded with wage-derived vault transfers only). ---
  const vaultAcct = accounts.find((a) => a.is_vault)
  let vaultSeed = 0
  if (vaultAcct) {
    for (const t of transfers) {
      if (CO_SURPLUS_SWEEP_KINDS.has(t.kind)) continue
      if (t.to_account_id === vaultAcct.id) vaultSeed += t.amount
      if (t.from_account_id === vaultAcct.id) vaultSeed -= t.amount
    }
  }
  const computed = computeAll(paychecks, settings, vaultSeed)

  // --- INCOME ---
  let income_baseNet = 0, income_perDiem = 0, income_reimb = 0, income_extra = 0
  for (const r of computed) {
    if (!r.received) continue
    const baseNet = r.actualNetWages != null ? r.actualNetWages : r.estimatedNet
    income_baseNet += baseNet
    income_perDiem += r.perDiem
    income_reimb += r.reimbursement
    income_extra += r.extraDeposit
  }

  let entry_cash_in = 0, entry_cc_credits = 0
  let entry_cash_out = 0, entry_cc_charges = 0
  for (const e of accountEntries) {
    if (e.dated_at > today) continue
    const a = accounts.find((x) => x.id === e.account_id)
    if (!a) continue
    if (a.type === 'credit_card') {
      if (e.amount < 0) entry_cc_credits += -e.amount
      else entry_cc_charges += e.amount
    } else {
      if (e.amount > 0) entry_cash_in += e.amount
      else entry_cash_out += -e.amount
    }
  }

  let exp_settled_refunds = 0
  for (const e of expenses) {
    if (e.expense_date > today) continue
    if (e.refund_settled) exp_settled_refunds += Number(e.refund_expected ?? 0)
  }

  const incomeRows: Row[] = [
    { label: 'Paycheck base net wages', amount: income_baseNet },
    { label: 'Per diem', amount: income_perDiem },
    { label: 'Reimbursements', amount: income_reimb },
    { label: 'Extra deposits (signing bonus)', amount: income_extra },
    { label: 'Cash reimbursements & side income (checking)', amount: entry_cash_in, note: 'Frictionless paycheck, Splitwise/Uber/Raghav/EasyTransfer settlements' },
    { label: 'Credit card statement credits', amount: entry_cc_credits, note: 'Vivek + Amazon refunds, Paze, Lemonade' },
    { label: 'Settled expense refunds', amount: exp_settled_refunds },
  ]
  const totalIncome = incomeRows.reduce((s, r) => s + r.amount, 0)

  // --- OUTFLOWS ---
  let out_rent = 0
  for (const r of computed) {
    const payISO = String(r.payDate)
    const rentOut = r.rentAmountOverride != null ? r.rentAmountOverride : r.rentPaid
    if (rentOut <= 0) continue
    const rentDate = r.rentDateOverride ?? defaultRentDate(payISO)
    if (rentDate <= today) out_rent += rentOut
  }

  let out_rh = 0
  for (const r of computed) {
    const payISO = String(r.payDate)
    if (payISO < RH_WEEKLY_CUTOVER && r.received) out_rh += r.robinhood
  }
  if (settings.robinhoodWeekly > 0) {
    for (const monday of mondaysBetween(RH_WEEKLY_CUTOVER, INTERNSHIP_END)) {
      if (monday <= today) out_rh += settings.robinhoodWeekly
    }
  }

  let out_exp_debit = 0, out_exp_cc = 0
  for (const e of expenses) {
    if (e.expense_date > today) continue
    const a = accounts.find((x) => x.id === e.account_id)
    if (!a) continue
    if (a.type === 'credit_card') out_exp_cc += e.amount
    else out_exp_debit += e.amount
  }

  const realSpendRows: Row[] = [
    { label: 'Rent (through today)', amount: out_rent },
    { label: 'Debit outflows (Lorenzo lease, Vivek loan, Car scratch, dining)', amount: entry_cash_out },
    { label: 'Credit card charges (logged expenses)', amount: out_exp_cc },
    { label: 'Debit expenses (logged expenses)', amount: out_exp_debit },
    { label: 'Additional CC charges (ledger)', amount: entry_cc_charges },
  ]
  const totalRealSpend = realSpendRows.reduce((s, r) => s + r.amount, 0)

  // --- SAVED (not spent, still yours) ---
  const savedRows: Row[] = [
    { label: 'Robinhood contributions', amount: out_rh },
  ]
  const totalSaved = savedRows.reduce((s, r) => s + r.amount, 0)

  // --- CURRENT BALANCES (authoritative) ---
  const states = computeAccountStates(
    accounts, paychecks, expenses, settings, ccPayments, transfers, accountEntries, today,
  )
  let cashNow = 0, ccNow = 0
  for (const st of states) {
    if (st.account.type === 'credit_card') ccNow += st.current
    else cashNow += st.current
  }
  const netWorthNow = cashNow - ccNow

  // Marcus growth = current Marcus - arrival Marcus
  const marcusState = states.find((st) => st.account.is_vault)
  const marcusGrowth = marcusState ? marcusState.current - marcusState.arrival : 0

  const totalOut = totalRealSpend + totalSaved
  const netChange = netWorthNow - arrivalNetWorth

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <Reveal>
        <PageHeader
          title="Summer Summary"
          subtitle="Everything since you arrived in Colorado, reconciled to the cent."
        />
      </Reveal>

      {/* Headline tiles */}
      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          marginBottom: 24,
        }}
      >
        <HeadlineTile label="Arrival net worth" value={arrivalNetWorth} hue={200} />
        <HeadlineTile label="Money made" value={totalIncome} hue={145} />
        <HeadlineTile label="Money spent" value={totalRealSpend} hue={25} />
        <HeadlineTile label="Money saved" value={totalSaved + marcusGrowth} hue={285} sub="Marcus + Robinhood" />
        <HeadlineTile label="Net worth now" value={netWorthNow} hue={45} delta={netChange} />
      </div>

      <Section title="Money made" total={totalIncome} rows={incomeRows} accent={145} />
      <Section title="Money spent" total={totalRealSpend} rows={realSpendRows} accent={25} />
      <Section
        title="Money saved (still yours)"
        total={totalSaved + marcusGrowth}
        rows={[
          { label: 'Marcus HYSA growth since arrival', amount: marcusGrowth },
          ...savedRows,
        ]}
        accent={285}
      />

      {/* Reconciliation footer */}
      <ReconCard
        arrival={arrivalNetWorth}
        income={totalIncome}
        realSpend={totalRealSpend}
        saved={totalSaved}
        netWorthNow={netWorthNow}
      />
    </div>
  )
}

function HeadlineTile({
  label,
  value,
  hue,
  delta,
  sub,
}: {
  label: string
  value: number
  hue: number
  delta?: number
  sub?: string
}) {
  const color = `oklch(0.72 0.14 ${hue})`
  return (
    <div
      className="card"
      style={{
        padding: 18,
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--radius)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <span
        style={{
          font: '500 11.5px var(--ui)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--ink-3)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          font: '600 26px var(--display)',
          color,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
        }}
      >
        {fmtMoney(value)}
      </span>
      {delta != null && (
        <span
          style={{
            font: '500 12px var(--ui)',
            color: delta >= 0 ? 'var(--pos-ink, oklch(0.72 0.14 145))' : 'var(--neg-ink, oklch(0.68 0.16 25))',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {delta >= 0 ? '+' : ''}{fmtMoney(delta)} since arrival
        </span>
      )}
      {sub && (
        <span style={{ font: '400 12px var(--ui)', color: 'var(--ink-3)' }}>{sub}</span>
      )}
    </div>
  )
}

function Section({
  title,
  total,
  rows,
  accent,
}: {
  title: string
  total: number
  rows: Row[]
  accent: number
}) {
  const color = `oklch(0.72 0.14 ${accent})`
  const visible = rows.filter((r) => Math.abs(r.amount) > 0.005)
  return (
    <div style={{ marginBottom: 24 }}>
      <SectionLabel>
        <span style={{ color }}>{title}</span>
      </SectionLabel>
      <div
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          background: 'var(--surface)',
          border: '1px solid var(--hair)',
          borderRadius: 'var(--radius)',
          marginTop: 8,
        }}
      >
        {visible.map((r, i) => (
          <div
            key={r.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 16,
              padding: '14px 18px',
              borderTop: i === 0 ? 'none' : '1px solid var(--hair)',
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  font: '500 14px var(--ui)',
                  color: 'var(--ink-1)',
                }}
              >
                {r.label}
              </div>
              {r.note && (
                <div
                  style={{
                    font: '400 12px var(--ui)',
                    color: 'var(--ink-3)',
                    marginTop: 2,
                  }}
                >
                  {r.note}
                </div>
              )}
            </div>
            <div
              style={{
                font: '600 14px var(--ui)',
                color: 'var(--ink-1)',
                fontVariantNumeric: 'tabular-nums',
                flexShrink: 0,
              }}
            >
              {fmtMoney(r.amount)}
            </div>
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '14px 18px',
            borderTop: '1px solid var(--hair)',
            background: 'color-mix(in oklch, var(--surface) 80%, var(--surface-2, var(--surface)))',
          }}
        >
          <span
            style={{
              font: '600 13px var(--ui)',
              color: 'var(--ink-2)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Total
          </span>
          <span
            style={{
              font: '700 16px var(--display)',
              color,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtMoney(total)}
          </span>
        </div>
      </div>
    </div>
  )
}

function ReconCard({
  arrival,
  income,
  realSpend,
  saved,
  netWorthNow,
}: {
  arrival: number
  income: number
  realSpend: number
  saved: number
  netWorthNow: number
}) {
  const computed = arrival + income - realSpend - saved
  // Marcus is captured on the "saved" side via marcusGrowth, so the identity
  // is arrival + income = spend + saved + (cashInAccounts + ccDelta).
  // Simpler for readers: show inflows minus outflows = current NW.
  const rows = [
    { label: 'Arrival net worth', amount: arrival, sign: '+' },
    { label: 'Money made', amount: income, sign: '+' },
    { label: 'Money spent', amount: realSpend, sign: '−' },
  ]
  return (
    <div
      className="card"
      style={{
        padding: 18,
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 'var(--radius)',
        marginTop: 8,
      }}
    >
      <div
        style={{
          font: '500 11.5px var(--ui)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--ink-3)',
          marginBottom: 12,
        }}
      >
        Reconciliation
      </div>
      <div style={{ display: 'grid', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', font: '500 13.5px var(--ui)', color: 'var(--ink-2)' }}>
            <span>
              <span style={{ display: 'inline-block', width: 14, color: 'var(--ink-3)' }}>{r.sign}</span>
              {r.label}
            </span>
            <span>{fmtMoney(r.amount)}</span>
          </div>
        ))}
        <div style={{ height: 1, background: 'var(--hair)', margin: '4px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', font: '700 15px var(--ui)', color: 'var(--ink-1)' }}>
          <span>
            <span style={{ display: 'inline-block', width: 14, color: 'var(--ink-3)' }}>=</span>
            Net worth now (Marcus + Robinhood + cash − CC debt)
          </span>
          <span>{fmtMoney(netWorthNow)}</span>
        </div>
        {Math.abs(computed - netWorthNow + saved) > 0.5 && (
          <div
            style={{
              marginTop: 8,
              font: '400 12px var(--ui)',
              color: 'var(--ink-3)',
            }}
          >
            Note: reconciliation gap of {fmtMoney(Math.abs(computed - netWorthNow + saved))} — likely from an untracked flow. Ping the reconciliation script to isolate.
          </div>
        )}
      </div>
    </div>
  )
}
