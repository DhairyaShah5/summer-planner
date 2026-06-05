import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AccountsList, type AccountRow } from './accounts-list'

export const dynamic = 'force-dynamic'

export default async function AccountsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [accountsRes, settingsRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .order('display_order', { ascending: true }),
    supabase.from('settings').select('vault_cap').maybeSingle(),
  ])

  if (accountsRes.error) throw accountsRes.error
  if (settingsRes.error) throw settingsRes.error

  const accounts: AccountRow[] = (accountsRes.data ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as AccountRow['type'],
    current_balance: Number(a.current_balance),
    is_paycheck_destination: a.is_paycheck_destination,
    is_vault: a.is_vault,
    display_order: a.display_order,
  }))

  const vaultCap = Number(settingsRes.data?.vault_cap ?? 0)

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 space-y-4">
      <div className="space-y-1">
        <h1 className="bg-gradient-to-r from-emerald-500 via-indigo-500 to-fuchsia-500 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          Accounts
        </h1>
        <p className="text-sm text-muted-foreground">
          Live balances. Adjust manually when statements arrive.
        </p>
      </div>
      <AccountsList accounts={accounts} vaultCap={vaultCap} />
    </div>
  )
}
