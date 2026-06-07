import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Settings } from '@/lib/types'
import { PageHeader } from '@/components/redesign'
import { PaychecksTable, type PaycheckRow } from './paychecks-table'

export const dynamic = 'force-dynamic'

export default async function PaychecksPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [settingsRes, paychecksRes] = await Promise.all([
    supabase.from('settings').select('*').maybeSingle(),
    supabase
      .from('paychecks')
      .select('*')
      .order('pay_num', { ascending: true }),
  ])

  if (settingsRes.error) throw settingsRes.error
  if (paychecksRes.error) throw paychecksRes.error

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
    extra_deposit: p.extra_deposit,
    vault_override: p.vault_override,
    gross_override: p.gross_override,
    rent_paid: p.rent_paid,
    notes: p.notes,
    received: p.received,
  }))

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Paycheck Plan"
        subtitle="Edit hours, per diem, and actual net as paychecks arrive. Computed columns update live."
      />
      <PaychecksTable initialRows={rows} settings={settings} />
    </div>
  )
}
