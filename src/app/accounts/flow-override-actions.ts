'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type FlowKind = 'vault' | 'rent' | 'robinhood' | 'robinhood_2'

/** Key used inside `paychecks.flow_overrides` to override the rent OUTFLOW
 *  amount independently of the allocator input (`rent_paid`). Kept as a
 *  string to match the other numeric-string flow overrides (`co_amount`,
 *  `bofa_overflow`). */
const RENT_AMOUNT_KEY = 'rent_amount'

export interface SetFlowOverrideInput {
  paycheck_id: string
  kind: FlowKind
  dated_at: string | null  // null clears the override
}

export interface ActionResult { ok: boolean; error?: string }

export async function setFlowOverride(
  input: SetFlowOverrideInput,
): Promise<ActionResult> {
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

/** Override a paycheck's rent OUTFLOW amount without touching `rent_paid`.
 *  The allocator (`computeAll`) keeps using `rent_paid` so vault/CO/BofA
 *  distributions don't shift — only the actual cash leaving Chase changes.
 *  Any positive delta (rent_paid − override) simply stays in Chase.
 *
 *  Pass `null` to clear the override and fall back to the natural amount.
 *  Pass `0` to "delete" the rent row (row still renders as $0, no outflow). */
export async function setPaycheckRentAmount(
  paycheck_id: string,
  amount: number | null,
): Promise<ActionResult> {
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
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

  const current = (data?.flow_overrides as Record<string, string> | null) ?? {}
  const next = { ...current }
  if (amount === null) delete next[RENT_AMOUNT_KEY]
  else next[RENT_AMOUNT_KEY] = String(amount)

  const { error: updErr } = await supabase
    .from('paychecks')
    .update({ flow_overrides: next })
    .eq('id', paycheck_id)
    .eq('user_id', user.id)
  if (updErr) return { ok: false, error: updErr.message }

  revalidatePath('/accounts')
  revalidatePath('/')
  revalidatePath('/weekly')
  revalidatePath('/paychecks')
  return { ok: true }
}
