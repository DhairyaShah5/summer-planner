import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  computeAccountStates,
  computeAll,
  type AccountEntryInput,
  type AccountInput,
  type CCPaymentInput,
  type ExpenseInput,
  type PaycheckInput,
  type Employer,
  type Settings,
  type TransferInput,
} from '@/lib/calc'
import { todayInUserTz } from '@/lib/today'
import { PageHeader } from '@/components/redesign'
import {
  AccountsList,
  type AccountStateRow,
  type LedgerEntryRow,
  type TransferRow,
} from './accounts-list'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    accountsRes,
    settingsRes,
    paychecksRes,
    expensesRes,
    ccPaymentsRes,
    transfersRes,
    accountEntriesRes,
  ] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .order('display_order', { ascending: true }),
    supabase.from('settings').select('*').maybeSingle(),
    supabase.from('paychecks').select('*').order('pay_num', { ascending: true }),
    supabase
      .from('expenses')
      .select('id, expense_date, amount, account_id, description, category'),
    supabase
      .from('cc_payments')
      .select('*')
      .order('paid_at', { ascending: false }),
    supabase
      .from('transfers')
      .select(
        'id, transferred_at, from_account_id, to_account_id, amount, kind, note',
      )
      .order('transferred_at', { ascending: false }),
    supabase
      .from('account_entries')
      .select(
        'id, account_id, dated_at, amount, description, note, created_at',
      )
      .order('dated_at', { ascending: true }),
  ])

  if (accountsRes.error) throw accountsRes.error
  if (settingsRes.error) throw settingsRes.error
  if (paychecksRes.error) throw paychecksRes.error
  if (expensesRes.error) throw expensesRes.error
  if (ccPaymentsRes.error) throw ccPaymentsRes.error
  if (transfersRes.error) throw transfersRes.error
  if (accountEntriesRes.error) throw accountEntriesRes.error

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
    reimbursement: p.reimbursement,
    extraDeposit: p.extra_deposit,
    vaultOverride: p.vault_override,
    grossOverride: p.gross_override,
    rentPaid: p.rent_paid,
    received: p.received,
  }))

  const expenseRowsRaw = expensesRes.data ?? []
  const expenses: ExpenseInput[] = expenseRowsRaw.map((e) => ({
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
    kind: p.kind ?? 'payment',
  }))

  const transferRowsRaw = transfersRes.data ?? []
  const transfers: TransferInput[] = transferRowsRaw.map((t) => ({
    id: t.id,
    transferred_at: t.transferred_at,
    from_account_id: t.from_account_id,
    to_account_id: t.to_account_id,
    amount: Number(t.amount),
    kind: t.kind,
  }))

  const transferRows: TransferRow[] = transferRowsRaw.map((t) => ({
    id: t.id,
    transferred_at: t.transferred_at,
    from_account_id: t.from_account_id,
    to_account_id: t.to_account_id,
    amount: Number(t.amount),
    kind: t.kind,
    note: t.note,
  }))

  const accountEntryRowsRaw = accountEntriesRes.data ?? []
  const accountEntries: AccountEntryInput[] = accountEntryRowsRaw.map((e) => ({
    id: e.id,
    account_id: e.account_id,
    dated_at: e.dated_at,
    amount: Number(e.amount),
    description: e.description,
  }))

  const entries: LedgerEntryRow[] = accountEntryRowsRaw.map((e) => ({
    id: e.id,
    account_id: e.account_id,
    dated_at: e.dated_at,
    amount: Number(e.amount),
    description: e.description,
    note: e.note,
    created_at: e.created_at,
  }))

  const states = computeAccountStates(
    accounts,
    paychecks,
    expenses,
    settings,
    ccPayments,
    transfers,
    accountEntries,
    todayInUserTz(),
  )

  // Build a side map of paycheck id + per-paycheck flow_overrides so the
  // ledger can look up overrides keyed by payNum (the computeAll-aligned key).
  const paycheckMetaByPayNum = new Map<
    number,
    { id: string; flow_overrides: Record<string, string> }
  >()
  for (const p of paychecksRes.data ?? []) {
    const overrides =
      (p.flow_overrides as Record<string, string> | null) ?? {}
    paycheckMetaByPayNum.set(p.pay_num, {
      id: p.id,
      flow_overrides: overrides,
    })
  }

  // Compute paycheck rows once so the ledger modal can derive per-paycheck
  // inflows/outflows without redoing the allocation math client-side.
  const paycheckRows = computeAll(paychecks, settings).map((r) => {
    const meta = paycheckMetaByPayNum.get(r.payNum)
    return {
      id: meta?.id ?? '',
      payNum: r.payNum,
      payDate: String(r.payDate),
      employer: r.employer,
      baseNet:
        r.received && r.actualNetWages != null
          ? r.actualNetWages
          : r.estimatedNet,
      perDiem: r.perDiem,
      reimbursement: r.reimbursement,
      vault: r.vault,
      extraDeposit: r.extraDeposit,
      rentPaid: r.rentPaid,
      robinhood: r.robinhood,
      bofaOverflow: r.bofaOverflow,
      received: r.received,
      flow_overrides: meta?.flow_overrides ?? {},
    }
  })

  const ledgerExpenseRows = expenseRowsRaw.map((e) => ({
    id: e.id,
    expense_date: e.expense_date,
    amount: Number(e.amount),
    account_id: e.account_id ?? null,
    description: e.description ?? '',
    category: e.category ?? '',
  }))

  const ledgerCCPaymentRows = ccPayments.map((p) => ({
    id: p.id,
    paid_at: p.paid_at,
    from_account_id: p.from_account_id,
    to_account_id: p.to_account_id,
    amount: p.amount,
    kind: p.kind,
  }))

  const includeMap = new Map<string, boolean>(
    (accountsRes.data ?? []).map((a) => [a.id, a.include_in_net_worth ?? true]),
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
    include_in_net_worth: includeMap.get(s.account.id) ?? true,
  }))

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        title="Accounts"
        subtitle="Live balances derived from paychecks + expenses. Arrival balances anchor the math."
      />
      <AccountsList
        states={stateRows}
        vaultCap={settings.vaultCap}
        transfers={transferRows}
        entries={entries}
        expenses={ledgerExpenseRows}
        ccPayments={ledgerCCPaymentRows}
        paycheckRows={paycheckRows}
      />
    </div>
  )
}
