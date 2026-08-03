'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isViewMode, viewOnlyError } from '@/lib/view-mode'

export type FlowKind = 'vault' | 'rent' | 'robinhood' | 'robinhood_2'

export interface SetFlowOverrideInput {
  paycheck_id: string
  kind: FlowKind
  dated_at: string | null  // null clears the override
}

export interface ActionResult { ok: boolean; error?: string }

export async function setFlowOverride(
  input: SetFlowOverrideInput,
): Promise<ActionResult> {
  if (await isViewMode()) return viewOnlyError()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  // Fetch current overrides JSONB.
  const { data, error } = await supabase
    .from('paychecks')
    .select('flow_overrides')
    .eq('id', input.paycheck_id)
    .eq('user_id', user.id)
    .single()
  if (error) return { ok: false, error: error.message }

  const current = (data?.flow_overrides as Record<string, string> | null) ?? {}
  const next = { ...current }
  if (input.dated_at) next[input.kind] = input.dated_at
  else delete next[input.kind]

  const { error: updErr } = await supabase
    .from('paychecks')
    .update({ flow_overrides: next })
    .eq('id', input.paycheck_id)
    .eq('user_id', user.id)
  if (updErr) return { ok: false, error: updErr.message }

  revalidatePath('/accounts')
  revalidatePath('/')
  revalidatePath('/weekly')
  revalidatePath('/paychecks')
  return { ok: true }
}

/** Update a paycheck's rent_paid amount. Pass 0 to remove the rent row
 *  entirely from the ledger (also clears any rent date override so the
 *  row doesn't linger as a $0 entry with an off-paycheck date). */
export async function setPaycheckRentAmount(
  paycheck_id: string,
  amount: number,
): Promise<ActionResult> {
  if (await isViewMode()) return viewOnlyError()
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number' }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const { data, error } = await supabase
    .from('paychecks')
    .select('flow_overrides')
    .eq('id', paycheck_id)
    .eq('user_id', user.id)
    .single()
  if (error) return { ok: false, error: error.message }

  const patch: { rent_paid: number; flow_overrides?: Record<string, string> } =
    { rent_paid: amount }

  if (amount === 0) {
    const current =
      (data?.flow_overrides as Record<string, string> | null) ?? {}
    if (current.rent) {
      const next = { ...current }
      delete next.rent
      patch.flow_overrides = next
    }
  }

  const { error: updErr } = await supabase
    .from('paychecks')
    .update(patch)
    .eq('id', paycheck_id)
    .eq('user_id', user.id)
  if (updErr) return { ok: false, error: updErr.message }

  revalidatePath('/accounts')
  revalidatePath('/')
  revalidatePath('/weekly')
  revalidatePath('/paychecks')
  return { ok: true }
}
