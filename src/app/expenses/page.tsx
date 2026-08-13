import { getViewerContext } from '@/lib/viewer-context'
import {
  computeAll,
  CO_SURPLUS_SWEEP_KINDS,
  type Settings,
  type PaycheckInput,
  type Employer,
} from '@/lib/calc'
import { todayInUserTz, dayOfWeekInUserTz } from '@/lib/today'
import type { Expense } from '@/lib/types'
import { PageHeader } from '@/components/redesign'
import { Reveal } from '@/components/redesign'
import { AddExpenseForm } from './add-expense-form'
import { ExpenseList } from './expense-list'
import type { AccountOption } from './add-expense-form'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
  const { supabase } = await getViewerContext()

  const [settingsRes, paychecksRes, expensesRes, accountsRes, transfersRes] =
    await Promise.all([
      supabase.from('settings').select('*').maybeSingle(),
      supabase
        .from('paychecks')
        .select('*')
        .order('pay_num', { ascending: true }),
      supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false })
        .limit(200),
      supabase
        .from('accounts')
        .select('id, name, type, is_vault')
        .order('display_order', { ascending: true }),
      supabase
        .from('transfers')
        .select('from_account_id, to_account_id, amount, kind, transferred_at'),
    ])

  if (settingsRes.error) throw settingsRes.error
  if (paychecksRes.error) throw paychecksRes.error
  if (expensesRes.error) throw expensesRes.error
  if (accountsRes.error) throw accountsRes.error
  if (transfersRes.error) throw transfersRes.error

  const expenses: Expense[] = (expensesRes.data ?? []).map((e) => ({
    id: e.id,
    expense_date: e.expense_date,
    description: e.description,
    amount: Number(e.amount),
    category: e.category ?? '',
    account_id: e.account_id ?? null,
    count_in_co_budget: e.count_in_co_budget ?? true,
    is_personal: e.is_personal ?? false,
    refund_expected:
      e.refund_expected != null ? Number(e.refund_expected) : null,
    refund_settled: e.refund_settled ?? false,
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
      nttVaultDefault: s.ntt_vault_default,
    }

    const inputs: PaycheckInput[] = (paychecksRes.data ?? []).map((p) => {
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
        reimbursement: p.reimbursement,
        extraDeposit: p.extra_deposit,
        vaultOverride: p.vault_override,
        grossOverride: p.gross_override,
        rentPaid: p.rent_paid,
        rentDateOverride: overrides.rent ?? null,
        rentAmountOverride:
          overrides.rent_amount != null
            ? Number(overrides.rent_amount)
            : null,
        coOverride:
          overrides.co_amount != null ? Number(overrides.co_amount) : null,
        bofaOverride:
          overrides.bofa_overflow != null
            ? Number(overrides.bofa_overflow)
            : null,
        robinhoodOverride:
          overrides.robinhood_amount != null
            ? Number(overrides.robinhood_amount)
            : null,
        received: p.received,
      }
    })

    // Seed prevCumulative with wage-derived Vault flows only. CO-surplus
    // sweeps are excluded so this page's cumMaxAllowed doesn't drift up
    // when a sweep locks CO into savings.
    const vaultAcct = (accountsRes.data ?? []).find((a) => a.is_vault)
    let initialVault = 0
    if (vaultAcct) {
      for (const t of transfersRes.data ?? []) {
        if (CO_SURPLUS_SWEEP_KINDS.has(t.kind)) continue
        if (t.to_account_id === vaultAcct.id) initialVault += Number(t.amount)
        if (t.from_account_id === vaultAcct.id)
          initialVault -= Number(t.amount)
      }
    }

    const computed = computeAll(inputs, settings, initialVault)

    // User-timezone today + "this Sunday" so the week boundary doesn't
    // shift around the user's local midnight (server runs in UTC).
    const todayISO = todayInUserTz()
    const day = dayOfWeekInUserTz()
    const daysUntilSunday = (7 - day) % 7
    const [y, m, d] = todayISO.split('-').map(Number)
    const sunday = new Date(y, (m ?? 1) - 1, (d ?? 1) + daysUntilSunday)
    const sundayISO = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`

    cumMaxAllowed = computed
      .filter((r) => String(r.payDate) <= sundayISO)
      .reduce((acc, r) => acc + r.co, 0)

    // Rollover sweeps commit CO surplus to Marcus, removing it from the
    // spendable pool. Subtract sweeps through today so "left to spend"
    // reflects only CO you can still actually spend.
    let sweptToDate = 0
    for (const t of transfersRes.data ?? []) {
      if (t.kind === 'rollover_sweep' && t.transferred_at <= todayISO) {
        sweptToDate += Number(t.amount)
      }
    }
    cumMaxAllowed -= sweptToDate

    cumSpent = expenses
      .filter((e) => e.expense_date <= todayISO && e.count_in_co_budget !== false)
      .reduce(
        (acc, e) => acc + (e.amount - (e.refund_expected ?? 0)),
        0,
      )
  }

  const pendingRefundTotal = expenses
    .filter((e) => (e.refund_expected ?? 0) > 0 && !e.refund_settled)
    .reduce((s, e) => s + (e.refund_expected ?? 0), 0)
  const settledRefundTotal = expenses
    .filter((e) => (e.refund_expected ?? 0) > 0 && e.refund_settled)
    .reduce((s, e) => s + (e.refund_expected ?? 0), 0)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <Reveal>
        <PageHeader
          title="Expenses"
          subtitle="Log spend as it happens, grouped by week."
        />
      </Reveal>
      <Reveal delay={40}>
        <AddExpenseForm
          accounts={accounts}
          defaultAccountId={defaultAccountId}
        />
      </Reveal>
      <ExpenseList
        expenses={expenses}
        accounts={accounts}
        cumMaxAllowed={cumMaxAllowed}
        cumSpent={cumSpent}
        pendingRefundTotal={pendingRefundTotal}
        settledRefundTotal={settledRefundTotal}
      />
    </div>
  )
}
