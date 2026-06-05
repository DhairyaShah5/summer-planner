import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  computeAll,
  type Settings,
  type PaycheckInput,
  type Employer,
} from '@/lib/calc'
import type { Expense } from '@/lib/types'
import { AddExpenseForm } from './add-expense-form'
import { ExpenseList } from './expense-list'
import type { AccountOption } from './add-expense-form'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [settingsRes, paychecksRes, expensesRes, accountsRes] = await Promise.all([
    supabase.from('settings').select('*').maybeSingle(),
    supabase.from('paychecks').select('*').order('pay_num', { ascending: true }),
    supabase
      .from('expenses')
      .select('*')
      .order('expense_date', { ascending: false })
      .limit(200),
    supabase
      .from('accounts')
      .select('id, name, type')
      .order('display_order', { ascending: true }),
  ])

  if (settingsRes.error) throw settingsRes.error
  if (paychecksRes.error) throw paychecksRes.error
  if (expensesRes.error) throw expensesRes.error
  if (accountsRes.error) throw accountsRes.error

  const expenses: Expense[] = (expensesRes.data ?? []).map((e) => ({
    id: e.id,
    expense_date: e.expense_date,
    description: e.description,
    amount: e.amount,
    category: e.category ?? '',
    account_id: e.account_id ?? null,
    created_at: e.created_at,
  }))

  const accounts: AccountOption[] = (accountsRes.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as AccountOption['type'],
  }))

  // Pre-select the Chase Credit Card by default if present.
  const defaultAccountId =
    accounts.find(
      (a) => a.type === 'credit_card' && /chase/i.test(a.name),
    )?.id ??
    accounts.find((a) => a.type === 'credit_card')?.id ??
    accounts[0]?.id ??
    null

  // `cumMaxAllowed` = sum of CO from every paycheck whose pay_date <= this
  // Sunday. `cumSpent` = sum of every expense whose date <= today. The
  // headline on the Expenses page compares these two so unspent CO from
  // earlier weeks rolls forward into the current "left to spend".
  let cumMaxAllowed = 0
  let cumSpent = 0
  const s = settingsRes.data
  if (s) {
    const settings: Settings = {
      vaultCap: s.vault_cap,
      uscGrossBaseline: s.usc_gross_baseline,
      nttHourlyRate: s.ntt_hourly_rate,
      uscNetPct: s.usc_net_pct,
      nttNetPct: s.ntt_net_pct,
      rentMonthly: s.rent_monthly,
      rentMonths: s.rent_months,
      robinhoodWeekly: s.robinhood_weekly,
      uscNoRentVault: s.usc_no_rent_vault,
      uscRentVault: s.usc_rent_vault,
    }

    const inputs: PaycheckInput[] = (paychecksRes.data ?? []).map((p) => ({
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
      received: p.received,
    }))

    const computed = computeAll(inputs, settings)

    const now = new Date()
    const day = now.getDay()
    const daysUntilSunday = (7 - day) % 7
    const sunday = new Date(now)
    sunday.setDate(now.getDate() + daysUntilSunday)
    const sundayISO = sunday.toISOString().slice(0, 10)
    const todayISO = now.toISOString().slice(0, 10)

    cumMaxAllowed = computed
      .filter((r) => String(r.payDate) <= sundayISO)
      .reduce((acc, r) => acc + r.co, 0)

    cumSpent = expenses
      .filter((e) => e.expense_date <= todayISO)
      .reduce((acc, e) => acc + e.amount, 0)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8 space-y-4">
      <div className="space-y-1">
        <h1 className="bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Expenses
        </h1>
        <p className="text-sm text-muted-foreground">
          Log spend as it happens. Grouped by week.
        </p>
      </div>
      <AddExpenseForm
        accounts={accounts}
        defaultAccountId={defaultAccountId}
      />
      <ExpenseList
        expenses={expenses}
        accounts={accounts}
        cumMaxAllowed={cumMaxAllowed}
        cumSpent={cumSpent}
      />
    </div>
  )
}
