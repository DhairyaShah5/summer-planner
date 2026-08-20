import { cache } from 'react'
import { getViewerContext } from '@/lib/viewer-context'
import {
  computeAll,
  summarize,
  CO_SURPLUS_SWEEP_KINDS,
  INTERNSHIP_END,
  parseLenderRouting,
  type Employer,
  type PaycheckInput,
  type Settings,
} from '@/lib/calc'
import { todayInUserTz } from '@/lib/today'

export type GoalStatus = {
  isReached: boolean
  /** goal reached AND the summer is over — the app has served its purpose. */
  isRetired: boolean
  current: number
  cap: number
  projected: number
  paycheckContributions: number
  deadlineISO: string
  todayISO: string
  /** Days between the tuition deadline and the date the vault physically
   *  first crossed the cap. Positive = early. Used by the celebration modal
   *  as "N days before USC came knocking." */
  daysAheadOfDeadline: number
  /** ISO date the vault first crossed the cap. Null if not yet reached. */
  goalReachedISO: string | null
  internshipEndISO: string
  /** Total money still owed to lenders. Shown on the dashboard as a
   *  separate ledger item — does NOT reduce the vault or gate the
   *  celebration (the vault is Marcus's physical balance; debt is a
   *  parallel obligation the user pays back from future paychecks). */
  lenderOutstandingTotal: number
}

const DEADLINE_ISO = '2026-08-21'

const EMPTY_STATUS: GoalStatus = {
  isReached: false,
  isRetired: false,
  current: 0,
  cap: 0,
  projected: 0,
  paycheckContributions: 0,
  deadlineISO: DEADLINE_ISO,
  todayISO: DEADLINE_ISO,
  daysAheadOfDeadline: 0,
  goalReachedISO: null,
  internshipEndISO: INTERNSHIP_END,
  lenderOutstandingTotal: 0,
}

// Cached per-request so the layout probe and any page-level compute don't
// double-query. Mirrors the dashboard's vault math (summarize().currentVault
// clamped by cap, plus net Vault-account transfers) so what the tile shows
// and what the celebration sees stay in lock-step.
export const getGoalStatus = cache(async (): Promise<GoalStatus> => {
  try {
    const { supabase } = await getViewerContext()
    const [
      accountsRes,
      settingsRes,
      paychecksRes,
      transfersRes,
      entriesRes,
      lendersRes,
    ] = await Promise.all([
      supabase.from('accounts').select('id, is_vault, arrival_balance'),
      supabase.from('settings').select('*').maybeSingle(),
      supabase
        .from('paychecks')
        .select('*')
        .order('pay_num', { ascending: true }),
      supabase
        .from('transfers')
        .select('to_account_id, from_account_id, amount, kind, transferred_at'),
      supabase
        .from('account_entries')
        .select('account_id, amount, dated_at'),
      supabase.from('lenders').select('outstanding'),
    ])

    if (accountsRes.error) throw accountsRes.error
    if (settingsRes.error) throw settingsRes.error
    if (paychecksRes.error) throw paychecksRes.error
    if (transfersRes.error) throw transfersRes.error
    if (entriesRes.error) throw entriesRes.error
    // lenders table may not exist yet (migration hasn't been applied). Treat
    // any error as "no lenders" so the dashboard keeps working; the goal just
    // won't have any debt-gating until the migration lands.
    const lenderRows = lendersRes.error ? [] : (lendersRes.data ?? [])
    const lenderOutstandingTotal = lenderRows.reduce(
      (s, l) => s + Number(l.outstanding ?? 0),
      0,
    )

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

    // Marcus events by date, used to figure out when the vault physically
    // first crossed the cap. Each event: { date, amount signed }. Includes
    // arrival balance (dated at the earliest event so it seeds the walk),
    // transfers in/out, free-form entries, and each received paycheck's
    // Marcus-bound inflow (vault - lenderPayoutTotal + extraDeposit).
    const marcusEvents: Array<{ date: string; amount: number }> = []

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
      if (t.transferred_at)
        marcusEvents.push({ date: t.transferred_at, amount: signed })
    }

    // Free-form Marcus entries (e.g. manual BofA fee-vault sweep) are neither
    // paycheck-driven nor transfers, so they'd be invisible to summarize().
    // Fold them in so goal-status matches the dashboard + Accounts page.
    let vaultEntriesTotal = 0
    for (const e of entriesRes.data ?? []) {
      if (e.account_id !== vaultAcct.id) continue
      const amt = Number(e.amount)
      vaultEntriesTotal += amt
      if (e.dated_at) marcusEvents.push({ date: e.dated_at, amount: amt })
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
          robinhoodOverride:
            overrides.robinhood_amount != null
              ? Number(overrides.robinhood_amount)
              : null,
          lenderRouting: parseLenderRouting(p.flow_overrides),
          received: p.received,
        }
      },
    )

    const computed = computeAll(paycheckInputs, settings, externalVaultPlanSeed)
    const totals = summarize(computed, settings)

    // Fold each received paycheck's Marcus-bound inflow into the event list,
    // then figure out when the running Marcus balance first hit the cap.
    // Routed vault money (lenderPayoutTotal) is excluded — that money Zelle's
    // straight to a friend and never grows Marcus.
    for (const r of computed) {
      if (!r.received) continue
      const marcusInflow = r.vault + r.extraDeposit - (r.lenderPayoutTotal ?? 0)
      if (marcusInflow === 0) continue
      const dateISO =
        typeof r.payDate === 'string'
          ? r.payDate
          : (r.payDate as Date).toISOString().slice(0, 10)
      marcusEvents.push({ date: dateISO, amount: marcusInflow })
    }
    marcusEvents.sort((a, b) => a.date.localeCompare(b.date))
    let goalReachedISO: string | null = null
    {
      let running = Number(vaultAcct.arrival_balance ?? 0)
      const cap = settings.vaultCap
      if (cap > 0 && running + 0.005 >= cap) {
        // Already at cap from arrival; use the earliest event date we have,
        // or fall back to today. This is an odd edge case, not the norm.
        goalReachedISO = marcusEvents[0]?.date ?? todayInUserTz()
      } else {
        for (const e of marcusEvents) {
          running += e.amount
          if (cap > 0 && running + 0.005 >= cap) {
            goalReachedISO = e.date
            break
          }
        }
      }
    }

    // Vault = Marcus's physical balance. Debt is a parallel obligation
    // tracked separately (Money Owed card on the dashboard); it does NOT
    // reduce the vault progress. The vault goal is a savings milestone;
    // paying back friends is a downstream ledger event.
    const rawCurrent =
      totals.currentVault + externalVaultBalance + vaultEntriesTotal
    const rawProjected =
      totals.totalVault + externalVaultBalance + vaultEntriesTotal
    const currentVault = Math.min(settings.vaultCap, rawCurrent)
    const projected = Math.min(settings.vaultCap, rawProjected)

    const paycheckContributions = paycheckInputs.filter((p) => p.received).length
    const todayISO = todayInUserTz()
    const msPerDay = 1000 * 60 * 60 * 24
    // "Days ahead of deadline" is measured from the date the vault first
    // hit cap, NOT from today. So if the vault was full on Aug 18 and the
    // deadline is Aug 21, the celebration reads "3 days early" no matter
    // when the user actually opens the modal.
    const daysAheadOfDeadline = goalReachedISO
      ? Math.max(
          0,
          Math.round(
            (new Date(DEADLINE_ISO).getTime() -
              new Date(goalReachedISO).getTime()) /
              msPerDay,
          ),
        )
      : 0

    // isReached fires when Marcus is full AND no debt is outstanding. The
    // vault tile shows the raw $24k regardless (debt is a parallel ledger,
    // not a vault deduction), but the celebration is the "you actually got
    // there" moment, which only makes sense once the friends who bridged
    // the tuition deadline have been squared up.
    const vaultFull =
      settings.vaultCap > 0 && currentVault + 0.005 >= settings.vaultCap
    const debtClear = lenderOutstandingTotal < 0.005
    const isReached = vaultFull && debtClear
    const isRetired = isReached && todayISO > INTERNSHIP_END
    return {
      isReached,
      isRetired,
      current: currentVault,
      cap: settings.vaultCap,
      projected,
      paycheckContributions,
      deadlineISO: DEADLINE_ISO,
      todayISO,
      daysAheadOfDeadline,
      goalReachedISO,
      internshipEndISO: INTERNSHIP_END,
      lenderOutstandingTotal,
    }
  } catch (err) {
    console.error('[goal-status] failed', err)
    return EMPTY_STATUS
  }
})
