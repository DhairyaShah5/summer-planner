import { cache } from 'react'
import { getViewerContext } from '@/lib/viewer-context'
import {
  computeAccountStates,
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

export type GoalStatus = {
  isReached: boolean
  current: number
  cap: number
  projected: number
  paycheckContributions: number
  deadlineISO: string
  todayISO: string
  daysUntilDeadline: number
}

const DEADLINE_ISO = '2026-09-02'

// Cached per-request so the layout probe and any page-level compute don't
// double-query. Returns null when settings/accounts aren't set up yet, which
// the CelebrationProvider treats as "no goal to reach".
export const getGoalStatus = cache(async (): Promise<GoalStatus | null> => {
  try {
    const { supabase } = await getViewerContext()
    const [
      accountsRes,
      settingsRes,
      paychecksRes,
      expensesRes,
      ccPaymentsRes,
      transfersRes,
      accountEntriesRes,
    ] = await Promise.all([
      supabase.from('accounts').select('*'),
      supabase.from('settings').select('*').maybeSingle(),
      supabase.from('paychecks').select('*').order('pay_num', { ascending: true }),
      supabase
        .from('expenses')
        .select(
          'id, expense_date, amount, account_id, refund_expected, refund_settled',
        ),
      supabase.from('cc_payments').select('*'),
      supabase
        .from('transfers')
        .select('id, transferred_at, from_account_id, to_account_id, amount, kind'),
      supabase.from('account_entries').select('*'),
    ])

    const settingsRow = settingsRes.data
    if (!settingsRow) return null
    if (!accountsRes.data || accountsRes.data.length === 0) return null

    const settings: Settings = {
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

    const accounts: AccountInput[] = accountsRes.data.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type as AccountInput['type'],
      arrival_balance: Number(a.arrival_balance),
      is_paycheck_destination: a.is_paycheck_destination,
      is_vault: a.is_vault,
      display_order: a.display_order,
    }))

    const paychecks: PaycheckInput[] = (paychecksRes.data ?? []).map((p) => {
      const overrides = (p.flow_overrides as Record<string, string> | null) ?? {}
      return {
        payNum: p.pay_num,
        payDate: p.pay_date,
        employer: p.employer as Employer,
        hoursWorked: p.hours_worked,
        otHours: p.ot_hours,
        actualNetWages: p.actual_net_wages,
        perDiem: p.per_diem,
        reimbursement: p.reimbursement ?? 0,
        extraDeposit: p.extra_deposit,
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

    const expenses: ExpenseInput[] = (expensesRes.data ?? []).map((e) => ({
      id: e.id,
      expense_date: e.expense_date,
      amount: Number(e.amount),
      account_id: e.account_id,
      refund_expected:
        e.refund_expected != null ? Number(e.refund_expected) : null,
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

    const accountEntries: AccountEntryInput[] = (accountEntriesRes.data ?? []).map(
      (e) => ({
        id: e.id,
        account_id: e.account_id,
        dated_at: e.dated_at,
        amount: Number(e.amount),
        description: e.description,
      }),
    )

    const todayISO = todayInUserTz()
    const states = computeAccountStates(
      accounts,
      paychecks,
      expenses,
      settings,
      ccPayments,
      transfers,
      accountEntries,
      todayISO,
    )
    const vaultState = states.find((s) => s.account.is_vault)
    if (!vaultState) return null

    const paycheckContributions = paychecks.filter((p) => p.received).length
    const msPerDay = 1000 * 60 * 60 * 24
    const daysUntilDeadline = Math.max(
      0,
      Math.round(
        (new Date(DEADLINE_ISO).getTime() - new Date(todayISO).getTime()) /
          msPerDay,
      ),
    )

    return {
      isReached: vaultState.current >= settings.vaultCap && settings.vaultCap > 0,
      current: vaultState.current,
      cap: settings.vaultCap,
      projected: vaultState.projected,
      paycheckContributions,
      deadlineISO: DEADLINE_ISO,
      todayISO,
      daysUntilDeadline,
    }
  } catch {
    return null
  }
})
