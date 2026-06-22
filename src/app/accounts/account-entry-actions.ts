'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isViewMode, viewOnlyError } from '@/lib/view-mode'

export interface AddAccountEntryInput {
  account_id: string
  dated_at: string
  amount: number
  description: string
  note?: string | null
}

export interface ActionResult {
  ok: boolean
  error?: string
}

/**
 * Insert a free-form ledger entry against one account. `amount` is signed:
 * positive = inflow (or, for credit cards, outstanding goes up), negative =
 * outflow. Validates a non-zero amount and a non-empty description so the
 * ledger row stays readable.
 */
export async function addAccountEntry(
  input: AddAccountEntryInput,
): Promise<ActionResult> {
  if (await isViewMode()) return viewOnlyError()
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  if (!input.account_id) return { ok: false, error: 'Account required' }
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    return { ok: false, error: 'Amount must be non-zero' }
  }
  const description = input.description?.trim()
  if (!description) return { ok: false, error: 'Description required' }
  const note = input.note?.trim()

  const { error: insertErr } = await supabase.from('account_entries').insert({
    user_id: user.id,
    account_id: input.account_id,
    dated_at: input.dated_at ?? new Date().toISOString().slice(0, 10),
    amount: input.amount,
    description,
    note: note && note.length > 0 ? note : null,
  })
  if (insertErr) return { ok: false, error: insertErr.message }

  revalidatePath('/accounts')
  revalidatePath('/')
  revalidatePath('/weekly')
  return { ok: true }
}

export interface UpdateAccountEntryInput {
  id: string
  dated_at: string
  amount: number
  description: string
  note?: string | null
}

export async function updateAccountEntry(
  input: UpdateAccountEntryInput,
): Promise<ActionResult> {
  if (await isViewMode()) return viewOnlyError()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  if (!input.id) return { ok: false, error: 'Entry id required' }
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    return { ok: false, error: 'Amount must be non-zero' }
  }
  const description = input.description?.trim()
  if (!description) return { ok: false, error: 'Description required' }
  const note = input.note?.trim()

  const { error } = await supabase
    .from('account_entries')
    .update({
      dated_at: input.dated_at,
      amount: input.amount,
      description,
      note: note && note.length > 0 ? note : null,
    })
    .eq('id', input.id)
    .eq('user_id', user.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/accounts')
  revalidatePath('/')
  revalidatePath('/weekly')
  return { ok: true }
}

/**
 * Delete a ledger entry. Scoped to the signed-in user so users cannot delete
 * each other's rows; combine with RLS for defense in depth.
 */
export async function deleteAccountEntry(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Entry id required' }
  if (await isViewMode()) return viewOnlyError()
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const { error } = await supabase
    .from('account_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/accounts')
  revalidatePath('/')
  revalidatePath('/weekly')
  return { ok: true }
}
