import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  computeAccountStates,
  type AccountInput,
  type CCPaymentInput,
  type ExpenseInput,
  type PaycheckInput,
  type Employer,
  type Settings,
} from '@/lib/calc'
import { AccountsList, type AccountStateRow } from './accounts-list'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [accountsRes, settingsRes, paychecksRes, expensesRes, ccPaymentsRes] =
    await Promise.all([
      supabase
        .from('accounts')
        .select('*')
        .order('display_order', { ascending: true }),
      supabase.from('settings').select('*').maybeSingle(),
      supabase.from('paychecks').select('*').order('pay_num', { ascending: true }),
      supabase
        .from('expenses')
        .select('id, expense_date, amount, account_id'),
      supabase
        .from('cc_payments')
        .select('*')
        .order('paid_at', { ascending: false }),
    ])

  if (accountsRes.error) throw accountsRes.error
  if (settingsRes.error) throw settingsRes.error
  if (paychecksRes.error) throw paychecksRes.error
  if (expensesRes.error) throw expensesRes.error
  if (ccPaymentsRes.error) throw ccPaymentsRes.error

  const accounts: AccountInput[] = (accountsRes.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as AccountInput['type'],
    arrival_balance: Number(a.arrival_balance),
    is_paycheck_destination: a.is_paycheck_destination,
    is_vault: a.is_vault,
    display_order: a.display_order,
  }))

  const settingsRow = settingsRes.data
  const settings: Settings = settingsRow
    ? {
        vaultCap: Number(settingsRow.vault_cap),
        uscGrossBaseline: Number(settingsRow.usc_gross_baseline),
        nttHourlyRate: Number(settingsRow.ntt_hourly_rate),
        uscNetPct: Number(settingsRow.usc_net_pct),
        nttNetPct: Number(settingsRow.ntt_net_pct),
        rentMonthly: Number(settingsRow.rent_monthly),
        rentMonths: Number(settingsRow.rent_months),
        robinhoodWeekly: Number(settingsRow.robinhood_weekly),
        uscNoRentVault: Number(settingsRow.usc_no_rent_vault),
        uscRentVault: Number(settingsRow.usc_rent_vault),
        nttVaultDefault: Number(settingsRow.ntt_vault_default),
      }
    : {
        vaultCap: 0,
        uscGrossBaseline: 0,
        nttHourlyRate: 0,
        uscNetPct: 0,
        nttNetPct: 0,
        rentMonthly: 0,
        rentMonths: 0,
        robinhoodWeekly: 0,
        uscNoRentVault: 0,
        uscRentVault: 0,
        nttVaultDefault: 0,
      }

  const paychecks: PaycheckInput[] = (paychecksRes.data ?? []).map((p) => ({
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

  const expenses: ExpenseInput[] = (expensesRes.data ?? []).map((e) => ({
    id: e.id,
    expense_date: e.expense_date,
    amount: Number(e.amount),
    account_id: e.account_id,
  }))

  const ccPayments: CCPaymentInput[] = (ccPaymentsRes.data ?? []).map((p) => ({
    id: p.id,
    paid_at: p.paid_at,
    from_account_id: p.from_account_id,
    to_account_id: p.to_account_id,
    amount: Number(p.amount),
  }))

  const states = computeAccountStates(
    accounts,
    paychecks,
    expenses,
    settings,
    ccPayments,
  )

  const stateRows: AccountStateRow[] = states.map((s) => ({
    id: s.account.id,
    name: s.account.name,
    type: s.account.type,
    arrival: s.arrival,
    current: s.current,
    projected: s.projected,
    is_paycheck_destination: s.account.is_paycheck_destination,
    is_vault: s.account.is_vault,
    display_order: s.account.display_order,
  }))

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 space-y-4">
      <div className="space-y-1">
        <h1 className="bg-gradient-to-r from-emerald-500 via-indigo-500 to-fuchsia-500 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Accounts
        </h1>
        <p className="text-sm text-muted-foreground">
          Live balances derived from paychecks + expenses. Arrival balances
          anchor the math.
        </p>
      </div>
      <AccountsList states={stateRows} vaultCap={settings.vaultCap} />
    </div>
  )
}
