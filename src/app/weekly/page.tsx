import { addDays, format, isAfter, isBefore, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { computeAll } from '@/lib/calc'
import type {
  Employer,
  PaycheckInput,
  Settings,
} from '@/lib/calc'
import { PageHeader } from '@/components/redesign'
import { WeeklyView, type WeeklyRow } from './weekly-view'

export const dynamic = 'force-dynamic'

const INTERNSHIP_START = '2026-05-26'
const INTERNSHIP_END = '2026-08-31'

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

export default async function WeeklyPage() {
  const supabase = await createClient()

  const [settingsRes, paychecksRes, expensesRes] = await Promise.all([
    supabase.from('settings').select('*').maybeSingle(),
    supabase.from('paychecks').select('*').order('pay_num', { ascending: true }),
    supabase.from('expenses').select('*').order('expense_date', { ascending: true }),
  ])

  const settingsRow = settingsRes.data
  const paycheckRows = paychecksRes.data ?? []
  const expenseRows = expensesRes.data ?? []

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

  const paycheckInputs: PaycheckInput[] = paycheckRows.map((p) => ({
    payNum: p.pay_num,
    payDate: p.pay_date,
    employer: p.employer as Employer,
    hoursWorked: p.hours_worked,
    otHours: p.ot_hours,
    actualNetWages: p.actual_net_wages,
    perDiem: p.per_diem,
    extraDeposit: p.extra_deposit,
    vaultOverride: p.vault_override,
    grossOverride: p.gross_override,
    rentPaid: p.rent_paid,
    received: p.received,
  }))

  const computed = computeAll(paycheckInputs, settings)

  const today = startOfDay(new Date())
  const startDate = parseISO(INTERNSHIP_START)
  const endDate = parseISO(INTERNSHIP_END)
  const weekBounds = buildWeeks(startDate, endDate)

  const weeks: WeeklyRow[] = weekBounds.map((w, i) => {
    const weekEnd = w.end
    let targetCumulative = 0
    let vaultBalance = 0
    for (const row of computed) {
      const pd = typeof row.payDate === 'string' ? parseISO(row.payDate) : row.payDate
      if (!isAfter(pd, weekEnd)) {
        targetCumulative += row.co
        vaultBalance = row.cumulativeVault
      }
    }
    let actualCumulative = 0
    for (const exp of expenseRows) {
      const ed = parseISO(exp.expense_date)
      if (!isAfter(ed, weekEnd)) {
        actualCumulative += exp.amount
      }
    }
    const variance = targetCumulative - actualCumulative
    const status: WeeklyRow['status'] =
      isBefore(weekEnd, today)
        ? 'Past'
        : !isAfter(w.start, today) && !isBefore(weekEnd, today)
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
  const totalActualToDate = expenseRows.reduce(
    (sum, e) => sum + (e.amount ?? 0),
    0,
  )
  const summerRemaining = totalSummerCO - totalActualToDate

  return (
    <WeeklyView
      weeks={weeks}
      summerRemaining={summerRemaining}
      totalActualToDate={totalActualToDate}
      totalSummerCO={totalSummerCO}
    />
  )
}
