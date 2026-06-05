'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface ActionResult {
  ok: boolean
  error?: string
}

/**
 * Server action invoked after the `received` checkbox on a paycheck row is
 * toggled. When the user marks a paycheck received, the actual net wages flow
 * into Chase Checking (the paycheck destination account); unmarking reverses
 * that.
 *
 * If `actual_net_wages` is null on the paycheck row, we silently no-op — the
 * user is expected to enter the actual number for the balance to update.
 */
export async function onReceivedToggled(
  paycheckId: string,
  received: boolean,
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const { data: paycheck, error: pcErr } = await supabase
    .from('paychecks')
    .select('id, actual_net_wages')
    .eq('id', paycheckId)
    .maybeSingle()
  if (pcErr) return { ok: false, error: pcErr.message }
  if (!paycheck) return { ok: false, error: 'Paycheck not found' }

  const net = paycheck.actual_net_wages
  if (net == null) {
    // No actual net wages entered yet — nothing to apply.
    revalidatePath('/paychecks')
    revalidatePath('/')
    revalidatePath('/accounts')
    return { ok: true }
  }

  const { data: dest, error: acctErr } = await supabase
    .from('accounts')
    .select('id, current_balance')
    .eq('is_paycheck_destination', true)
    .maybeSingle()
  if (acctErr) return { ok: false, error: acctErr.message }
  if (!dest) {
    // No destination account configured — nothing to apply.
    return { ok: true }
  }

  const delta = received ? Number(net) : -Number(net)
  const next = Number(dest.current_balance) + delta

  const { error: updErr } = await supabase
    .from('accounts')
    .update({ current_balance: next })
    .eq('id', dest.id)
  if (updErr) return { ok: false, error: updErr.message }

  revalidatePath('/paychecks')
  revalidatePath('/')
  revalidatePath('/accounts')
  return { ok: true }
}
