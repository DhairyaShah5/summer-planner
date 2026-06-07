'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type FlowKind = 'vault' | 'rent' | 'robinhood'

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
