import { cache } from 'react'
import { getViewerContext } from '@/lib/viewer-context'
import {
  computeAll,
  summarize,
  CO_SURPLUS_SWEEP_KINDS,
  type Employer,
  type PaycheckInput,
  type Settings,
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

const EMPTY_STATUS: GoalStatus = {
  isReached: false,
  current: 0,
  cap: 0,
  projected: 0,
  paycheckContributions: 0,
  deadlineISO: DEADLINE_ISO,
  todayISO: DEADLINE_ISO,
  daysUntilDeadline: 0,
}

// Cached per-request so the layout probe and any page-level compute don't
// double-query. Mirrors the dashboard's vault math (summarize().currentVault
// clamped by cap, plus net Vault-account transfers) so what the tile shows
// and what the celebration sees stay in lock-step.
export const getGoalStatus = cache(async (): Promise<GoalStatus> => {
  try {
    const { supabase } = await getViewerContext()
    const [accountsRes, settingsRes, paychecksRes, transfersRes] =
      await Promise.all([
        supabase.from('accounts').select('id, is_vault, arrival_balance'),
        supabase.from('settings').select('*').maybeSingle(),
        supabase
          .from('paychecks')
          .select('*')
          .order('pay_num', { ascending: true }),
        supabase
          .from('transfers')
          .select('to_account_id, from_account_id, amount, kind'),
      ])

    if (accountsRes.error) throw accountsRes.error
    if (settingsRes.error) throw settingsRes.error
    if (paychecksRes.error) throw paychecksRes.error
    if (transfersRes.error) throw transfersRes.error

    const settingsRow = settingsRes.data
    if (!settingsRow) return EMPTY_STATUS

    const vaultAcct = (accountsRes.data ?? []).find((a) => a.is_vault)
    if (!vaultAcct) return EMPTY_STATUS

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

    let externalVaultBalance = 0
    let externalVaultPlanSeed = 0
    for (const t of transfersRes.data ?? []) {
      const amt = Number(t.amount)
      const isInflow = t.to_account_id === vaultAcct.id
      const isOutflow = t.from_account_id === vaultAcct.id
      if (!isInflow && !isOutflow) continue
      const signed = isInflow ? amt : -amt
      externalVaultBalance += signed
      if (!CO_SURPLUS_SWEEP_KINDS.has(t.kind))
        externalVaultPlanSeed += signed
    }

    const paycheckInputs: PaycheckInput[] = (paychecksRes.data ?? []).map(
      (p) => {
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
          reimbursement: p.reimbursement ?? 0,
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
          received: p.received,
        }
      },
    )

    const computed = computeAll(paycheckInputs, settings, externalVaultPlanSeed)
    const totals = summarize(computed, settings)

    const currentVault = Math.min(
      settings.vaultCap,
      totals.currentVault + externalVaultBalance,
    )
    const projected = Math.min(
      settings.vaultCap,
      totals.totalVault + externalVaultBalance,
    )

    const paycheckContributions = paycheckInputs.filter((p) => p.received).length
    const todayISO = todayInUserTz()
    const msPerDay = 1000 * 60 * 60 * 24
    const daysUntilDeadline = Math.max(
      0,
      Math.round(
        (new Date(DEADLINE_ISO).getTime() - new Date(todayISO).getTime()) /
          msPerDay,
      ),
    )

    return {
      isReached:
        settings.vaultCap > 0 &&
        currentVault + 0.005 >= settings.vaultCap,
      current: currentVault,
      cap: settings.vaultCap,
      projected,
      paycheckContributions,
      deadlineISO: DEADLINE_ISO,
      todayISO,
      daysUntilDeadline,
    }
  } catch (err) {
    console.error('[goal-status] failed', err)
    return EMPTY_STATUS
  }
})
