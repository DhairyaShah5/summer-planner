import { getViewerContext } from '@/lib/viewer-context'
import type { Settings } from '@/lib/types'
import { CO_SURPLUS_SWEEP_KINDS } from '@/lib/calc'
import { PageHeader } from '@/components/redesign'
import { todayInUserTz } from '@/lib/today'
import { PaychecksTable, type PaycheckRow } from './paychecks-table'
import type { LenderOption } from './lender-routing-dialog'

export const dynamic = 'force-dynamic'

export default async function PaychecksPage() {
  const { supabase } = await getViewerContext()

  const [settingsRes, paychecksRes, accountsRes, transfersRes, lendersRes] =
    await Promise.all([
      supabase.from('settings').select('*').maybeSingle(),
      supabase
        .from('paychecks')
        .select('*')
        .order('pay_num', { ascending: true }),
      supabase
        .from('accounts')
        .select('id, name, is_paycheck_destination, is_vault'),
      supabase
        .from('transfers')
        .select('from_account_id, to_account_id, amount, kind'),
      supabase
        .from('lenders')
        .select('id, name, outstanding')
        .order('created_at', { ascending: true }),
    ])

  if (settingsRes.error) throw settingsRes.error
  if (paychecksRes.error) throw paychecksRes.error
  if (accountsRes.error) throw accountsRes.error
  if (transfersRes.error) throw transfersRes.error
  // Lenders table may not exist yet (migration pending). Fall back to none.
  const lenders: LenderOption[] = lendersRes.error
    ? []
    : (lendersRes.data ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        outstanding: Number(l.outstanding ?? 0),
      }))

  const s = settingsRes.data
  if (!s) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight">Paycheck Plan</h1>
        <p className="mt-4 text-muted-foreground">
          Settings not found. Visit{' '}
          <a href="/settings" className="underline">
            /settings
          </a>{' '}
          to initialize.
        </p>
      </div>
    )
  }

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

  const rows: PaycheckRow[] = (paychecksRes.data ?? []).map((p) => ({
    id: p.id,
    pay_num: p.pay_num,
    pay_date: p.pay_date,
    employer: p.employer,
    hours_worked: p.hours_worked,
    ot_hours: p.ot_hours,
    actual_net_wages: p.actual_net_wages,
    per_diem: p.per_diem,
    reimbursement: p.reimbursement,
    extra_deposit: p.extra_deposit,
    vault_override: p.vault_override,
    gross_override: p.gross_override,
    rent_paid: p.rent_paid,
    notes: p.notes,
    received: p.received,
    flow_overrides:
      (p.flow_overrides as Record<string, string> | null) ?? {},
  }))

  // Sum Chase→BofA transfers so the BofA column can tick once a paycheck's
  // bofaOverflow has been physically moved. Heuristic uses the
  // is_paycheck_destination flag (Chase) and the BofA account name match
  // — same trick computeAccountStates uses internally.
  const chase = (accountsRes.data ?? []).find((a) => a.is_paycheck_destination)
  const bofa = (accountsRes.data ?? []).find((a) => a.name === 'BofA Checking')
  const totalChaseToBofa =
    chase && bofa
      ? (transfersRes.data ?? [])
          .filter(
            (t) =>
              t.from_account_id === chase.id && t.to_account_id === bofa.id,
          )
          .reduce((s, t) => s + Number(t.amount), 0)
      : 0

  // Wage-buffer sweeps out of Chase. Only `buffer_sweep` transfers count —
  // they physically drain the wage-buffer portion of Chase into Marcus. A
  // rollover_sweep also touches Chase→Marcus but drains CO surplus (a
  // different pocket), so it must NOT be subtracted from the wage buffer.
  // Same rule for manual Chase→Marcus moves: intent is unknown, so keep
  // them out of the wage-buffer math and let them float in the raw balance.
  const vault = (accountsRes.data ?? []).find((a) => a.is_vault)
  const totalBufferSwept =
    chase && vault
      ? (transfersRes.data ?? [])
          .filter(
            (t) =>
              t.kind === 'buffer_sweep' &&
              t.from_account_id === chase.id &&
              t.to_account_id === vault.id,
          )
          .reduce((s, t) => s + Number(t.amount), 0)
      : 0
  // Net wage-derived Vault flow (manual + vault_topup_sweep). CO-surplus
  // sweeps are excluded so the paycheck plan doesn't re-shuffle when a
  // rollover/buffer sweep locks CO into savings.
  let externalVaultPlanSeed = 0
  if (vault) {
    for (const t of transfersRes.data ?? []) {
      if (CO_SURPLUS_SWEEP_KINDS.has(t.kind)) continue
      if (t.to_account_id === vault.id)
        externalVaultPlanSeed += Number(t.amount)
      if (t.from_account_id === vault.id)
        externalVaultPlanSeed -= Number(t.amount)
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Paycheck Plan"
        subtitle="Edit hours, per diem, and actual net as paychecks arrive. Computed columns update live."
      />
      <PaychecksTable
        initialRows={rows}
        settings={settings}
        todayISO={todayInUserTz()}
        totalChaseToBofa={totalChaseToBofa}
        totalBufferSwept={totalBufferSwept}
        initialCumulativeVault={externalVaultPlanSeed}
        lenders={lenders}
      />
    </div>
  )
}
