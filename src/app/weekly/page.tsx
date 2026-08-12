import { addDays, format, isAfter, isBefore, parseISO } from 'date-fns'
import { getViewerContext } from '@/lib/viewer-context'
import { computeAll, floor100, CO_SURPLUS_SWEEP_KINDS } from '@/lib/calc'
import { dayOfWeekInUserTz, todayInUserTz } from '@/lib/today'
import type {
  Employer,
  PaycheckInput,
  Settings,
} from '@/lib/calc'
import { PageHeader } from '@/components/redesign'
import { WeeklyView, type WeeklyRow } from './weekly-view'

export const dynamic = 'force-dynamic'

const INTERNSHIP_START = '2026-05-26'
const INTERNSHIP_END = '2026-09-06'

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function nextSundayOnOrAfter(d: Date): Date {
  const x = startOfDay(d)
  const day = x.getDay()
  const offset = day === 0 ? 0 : 7 - day
  return addDays(x, offset)
}

function buildWeeks(start: Date, end: Date): { start: Date; end: Date }[] {
  const weeks: { start: Date; end: Date }[] = []
  const firstEnd = nextSundayOnOrAfter(start)
  let weekEnd = firstEnd
  while (!isAfter(weekEnd, end) || weeks.length === 0) {
    const rawStart = addDays(weekEnd, -6)
    const weekStart = isBefore(rawStart, start) ? start : rawStart
    weeks.push({ start: weekStart, end: weekEnd })
    if (!isBefore(weekEnd, end)) break
    weekEnd = addDays(weekEnd, 7)
  }
  return weeks
}

function isoDate(d: Date): string {
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

export default async function WeeklyPage() {
  const { supabase } = await getViewerContext()

  const [settingsRes, paychecksRes, expensesRes, transfersRes, accountsRes] =
    await Promise.all([
      supabase.from('settings').select('*').maybeSingle(),
      supabase
        .from('paychecks')
        .select('*')
        .order('pay_num', { ascending: true }),
      supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: true }),
      supabase
        .from('transfers')
        .select('transferred_at, amount, kind, from_account_id, to_account_id'),
      supabase.from('accounts').select('id, name, is_vault'),
    ])

  const settingsRow = settingsRes.data
  const paycheckRows = paychecksRes.data ?? []
  const expenseRows = expensesRes.data ?? []
  const transferRows = transfersRes.data ?? []
  const accountRows = accountsRes.data ?? []

  if (!settingsRow) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <PageHeader
          title="Weekly Tracker"
          subtitle="Maximum allowed to spend (cumulative) vs actual spent · week ending Sunday."
        />
        <div
          className="fx-card"
          style={{
            padding: 22,
            background: 'var(--surface)',
            border: '1px solid var(--hair)',
            borderRadius: 'var(--radius)',
            color: 'var(--ink-2)',
            font: '500 14px var(--ui)',
          }}
        >
          Configure your settings to see the weekly breakdown.
        </div>
      </div>
    )
  }

  const settings: Settings = {
    vaultCap: settingsRow.vault_cap,
    uscGrossBaseline: settingsRow.usc_gross_baseline,
    nttHourlyRate: settingsRow.ntt_hourly_rate,
    uscNetPct: settingsRow.usc_net_pct,
    nttNetPct: settingsRow.ntt_net_pct,
    rentMonthly: settingsRow.rent_monthly,
    rentMonths: settingsRow.rent_months,
    robinhoodWeekly: settingsRow.robinhood_weekly,
    uscNoRentVault: settingsRow.usc_no_rent_vault,
    uscRentVault: settingsRow.usc_rent_vault,
    nttVaultDefault: settingsRow.ntt_vault_default,
  }

  const paycheckInputs: PaycheckInput[] = paycheckRows.map((p) => {
    const overrides =
      (p.flow_overrides as Record<string, string> | null) ?? {}
    return {
      payNum: p.pay_num,
      payDate: p.pay_date,
      employer: p.employer as Employer,
      hoursWorked: p.hours_worked,
      otHours: p.ot_hours,
      actualNetWages: p.actual_net_wages,
      perDiem: p.per_diem,
      extraDeposit: p.extra_deposit,
      reimbursement: p.reimbursement ?? 0,
      vaultOverride: p.vault_override,
      grossOverride: p.gross_override,
      rentPaid: p.rent_paid,
      rentDateOverride: overrides.rent ?? null,
      rentAmountOverride:
        overrides.rent_amount != null ? Number(overrides.rent_amount) : null,
      coOverride:
        overrides.co_amount != null ? Number(overrides.co_amount) : null,
      bofaOverride:
        overrides.bofa_overflow != null
          ? Number(overrides.bofa_overflow)
          : null,
      received: p.received,
    }
  })

  // Net wage-derived vault flows (manual transfers in, vault_topup_sweeps)
  // shrink per-paycheck vault contributions from the end. CO-surplus sweeps
  // are deliberately excluded: they represent CO leaving the spending pool
  // into savings, and re-planning around them would inflate future CO.
  const vaultAcct = accountRows.find((a) => a.is_vault)
  let externalVaultPlanSeed = 0
  if (vaultAcct) {
    for (const t of transferRows) {
      if (CO_SURPLUS_SWEEP_KINDS.has(t.kind)) continue
      if (t.to_account_id === vaultAcct.id)
        externalVaultPlanSeed += Number(t.amount)
      if (t.from_account_id === vaultAcct.id)
        externalVaultPlanSeed -= Number(t.amount)
    }
  }

  const computed = computeAll(paycheckInputs, settings, externalVaultPlanSeed)

  // User-timezone "today" (YYYY-MM-DD). Server runs in UTC so calling
  // `new Date()` directly would flip the date around the user's local
  // midnight; using America/Denver keeps the planner's notion of "today"
  // aligned with the user's clock.
  const todayStr = todayInUserTz()
  const startDate = parseISO(INTERNSHIP_START)
  const endDate = parseISO(INTERNSHIP_END)
  const weekBounds = buildWeeks(startDate, endDate)

  // Vault account drives the weekly Vault Balance column. cumulativeVault
  // alone only tracks scheduled per-paycheck contributions; non-paycheck
  // inflows (BofA→Vault sweeps, manual transfers in) live in `transfers`
  // and have to be folded in so the column matches the real HYSA balance.
  const vaultAccountId = accountRows.find((a) => a.is_vault)?.id ?? ''

  const weeks: WeeklyRow[] = weekBounds.map((w, i) => {
    const weekEnd = w.end
    const weekEndISO = isoDate(weekEnd)
    const weekStartISO = isoDate(w.start)
    let targetCumulative = 0
    let vaultBalance = 0
    for (const row of computed) {
      const pd = typeof row.payDate === 'string' ? parseISO(row.payDate) : row.payDate
      if (!isAfter(pd, weekEnd)) {
        targetCumulative += row.co
        vaultBalance = row.cumulativeVault
      }
    }
    // cumulativeVault includes `externalVaultPlanSeed` (wage-derived vault
    // transfers pre-loaded onto row 1) so the paycheck plan can shrink vault
    // contributions from the end. But that treats every transfer as if it
    // happened at t=0, which is wrong for the weekly balance column that
    // has to be time-accurate. Undo the seed first, then layer in the real
    // dated transfers (INCLUDING CO-surplus sweeps, which never enter the
    // seed but still physically live in Marcus) so the weekly balance
    // reflects what's actually in Marcus by that week's Sunday.
    vaultBalance -= externalVaultPlanSeed
    if (vaultAccountId) {
      for (const t of transferRows) {
        if (t.transferred_at > weekEndISO) continue
        if (t.to_account_id === vaultAccountId) vaultBalance += Number(t.amount)
        if (t.from_account_id === vaultAccountId)
          vaultBalance -= Number(t.amount)
      }
    }
    // Mirror cumulativeVault's cap clamp so sweeps that brush against the
    // ceiling don't push the displayed balance above the goal.
    if (settings.vaultCap > 0) {
      vaultBalance = Math.min(vaultBalance, settings.vaultCap)
    }
    let actualCumulative = 0
    for (const exp of expenseRows) {
      // Off-budget expenses don't feed Spending vs Budget / variance.
      if (exp.count_in_co_budget === false) continue
      const ed = parseISO(exp.expense_date)
      if (!isAfter(ed, weekEnd)) {
        actualCumulative +=
          exp.amount - (exp.refund_expected ? Number(exp.refund_expected) : 0)
      }
    }
    const variance = targetCumulative - actualCumulative
    // Compare as YYYY-MM-DD strings so server timezone can't flip a
    // Sunday-night-local entry into next week's bucket.
    const status: WeeklyRow['status'] =
      weekEndISO < todayStr
        ? 'Past'
        : weekStartISO <= todayStr && todayStr <= weekEndISO
          ? 'Current'
          : 'Future'

    return {
      index: i + 1,
      startISO: w.start.toISOString(),
      endISO: weekEnd.toISOString(),
      startLabel: format(w.start, 'MMM d'),
      endLabel: format(weekEnd, 'MMM d'),
      budget: Math.round(targetCumulative * 100) / 100,
      spent: Math.round(actualCumulative * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      vaultBalance: Math.round(vaultBalance * 100) / 100,
      status,
    }
  })

  const totalSummerCO = computed.reduce((sum, r) => sum + r.co, 0)
  // totalActualExpensesToDate = real consumption (off-budget excluded).
  // totalCoSavedToDate = CO-surplus swept into Marcus (rollover + buffer).
  // Together they equal the CO "utilized" so far; summerRemaining subtracts
  // both from the plan.
  const totalActualExpensesToDate = expenseRows
    .filter((e) => e.count_in_co_budget !== false)
    .reduce(
      (sum, e) =>
        sum + ((e.amount ?? 0) - (e.refund_expected ? Number(e.refund_expected) : 0)),
      0,
    )
  const totalCoSavedToDate = vaultAcct
    ? transferRows
        .filter(
          (t) =>
            CO_SURPLUS_SWEEP_KINDS.has(t.kind) &&
            t.to_account_id === vaultAcct.id &&
            t.transferred_at <= todayStr,
        )
        .reduce((sum, t) => sum + Number(t.amount), 0)
    : 0
  const totalCoUtilizedToDate = totalActualExpensesToDate + totalCoSavedToDate
  const summerRemaining = totalSummerCO - totalCoUtilizedToDate

  // --- Rollover sweep computation ---
  // Find last Sunday in the user's timezone. Server is UTC, so we use a
  // TZ-aware day-of-week + a parsed-local date as the pivot.
  const todayLocal = parseISO(todayStr)
  const dayOfWeek = dayOfWeekInUserTz() // 0=Sun, 1=Mon, ...
  // Days since Monday (Mon=0, Tue=1, ..., Sun=6)
  const daysSinceMonday = (dayOfWeek + 6) % 7
  const thisMonday = addDays(todayLocal, -daysSinceMonday)
  const lastSunday = addDays(thisMonday, -1)
  const lastSundayISO = isoDate(lastSunday)
  const todayISOStr = todayStr

  let cumAllowedThroughLastSunday = 0
  for (const row of computed) {
    const payDateISO =
      typeof row.payDate === 'string'
        ? row.payDate
        : isoDate(row.payDate as Date)
    if (payDateISO <= lastSundayISO) {
      cumAllowedThroughLastSunday += row.co
    }
  }

  let cumSpentThroughLastSunday = 0
  for (const exp of expenseRows) {
    // Off-budget expenses don't enter the rollover-sweep math.
    if (exp.count_in_co_budget === false) continue
    if (exp.expense_date <= lastSundayISO) {
      cumSpentThroughLastSunday +=
        (exp.amount ?? 0) -
        (exp.refund_expected ? Number(exp.refund_expected) : 0)
    }
  }

  let sweptRollover = 0
  for (const t of transferRows) {
    if (t.kind === 'rollover_sweep' && t.transferred_at <= todayISOStr) {
      sweptRollover += Number(t.amount)
    }
  }

  const rolloverSurplus =
    cumAllowedThroughLastSunday - cumSpentThroughLastSunday - sweptRollover
  const threshold = Number(settingsRow.rollover_sweep_threshold ?? 0)
  const cushion = Number(settingsRow.rollover_sweep_cushion ?? 0)
  const suggestedSweep = Math.max(0, floor100(rolloverSurplus - cushion))
  const showBanner = rolloverSurplus >= threshold && suggestedSweep > 0

  const chaseAccount = accountRows.find((a) => a.name === 'Chase Checking')
  const chaseAccountId = chaseAccount?.id ?? ''

  return (
    <WeeklyView
      weeks={weeks}
      summerRemaining={summerRemaining}
      totalActualExpensesToDate={totalActualExpensesToDate}
      totalCoSavedToDate={totalCoSavedToDate}
      totalSummerCO={totalSummerCO}
      rolloverSurplus={Math.round(rolloverSurplus * 100) / 100}
      suggestedSweep={suggestedSweep}
      threshold={threshold}
      cushion={cushion}
      showBanner={showBanner && !!chaseAccountId && !!vaultAccountId}
      chaseAccountId={chaseAccountId}
      vaultAccountId={vaultAccountId}
    />
  )
}
