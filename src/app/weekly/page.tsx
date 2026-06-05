import { addDays, format, isAfter, isBefore, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { computeAll } from '@/lib/calc'
import type {
  Employer,
  PaycheckInput,
  Settings,
} from '@/lib/calc'
import { cn } from '@/lib/utils'
import { WeeklyChart, type WeeklyChartPoint } from './weekly-chart'

export const dynamic = 'force-dynamic'

const INTERNSHIP_START = '2026-05-26'
const INTERNSHIP_END = '2026-08-31'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

interface Week {
  index: number
  start: Date
  end: Date
  targetCumulative: number
  actualCumulative: number
  variance: number
  vaultBalance: number
  status: 'Past' | 'Current' | 'Future'
}

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
      <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Tracker</CardTitle>
            <CardDescription>
              Configure your settings to see the weekly breakdown.
            </CardDescription>
          </CardHeader>
        </Card>
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
    rentPaid: p.rent_paid,
  }))

  const computed = computeAll(paycheckInputs, settings)

  const today = startOfDay(new Date())
  const startDate = parseISO(INTERNSHIP_START)
  const endDate = parseISO(INTERNSHIP_END)
  const weekBounds = buildWeeks(startDate, endDate)

  const weeks: Week[] = weekBounds.map((w, i) => {
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
    const status: Week['status'] =
      isBefore(weekEnd, today)
        ? 'Past'
        : !isAfter(w.start, today) && !isBefore(weekEnd, today)
          ? 'Current'
          : 'Future'

    return {
      index: i + 1,
      start: w.start,
      end: weekEnd,
      targetCumulative,
      actualCumulative,
      variance,
      vaultBalance,
      status,
    }
  })

  const chartData: WeeklyChartPoint[] = weeks.map((w) => ({
    weekEnd: format(w.end, 'MMM d'),
    target: Math.round(w.targetCumulative * 100) / 100,
    actual: Math.round(w.actualCumulative * 100) / 100,
  }))

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Weekly Tracker</h1>
        <p className="text-sm text-muted-foreground">
          Cumulative target vs actual CO spend, week ending Sunday.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Target vs Actual</CardTitle>
          <CardDescription>
            {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WeeklyChart data={chartData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Week</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead className="text-right">Target (cum)</TableHead>
                <TableHead className="text-right">Actual (cum)</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-right">Vault Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {weeks.map((w) => (
                <TableRow
                  key={w.index}
                  className={cn(
                    w.status === 'Current' &&
                      'bg-primary/5 border-l-4 border-l-primary',
                  )}
                >
                  <TableCell className="font-medium">{w.index}</TableCell>
                  <TableCell>{format(w.start, 'MMM d')}</TableCell>
                  <TableCell>{format(w.end, 'MMM d')}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money.format(w.targetCumulative)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money.format(w.actualCumulative)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums font-medium',
                      w.variance >= 0 ? 'text-emerald-600' : 'text-red-600',
                    )}
                  >
                    {money.format(w.variance)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money.format(w.vaultBalance)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        w.status === 'Current'
                          ? 'default'
                          : w.status === 'Past'
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {w.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
