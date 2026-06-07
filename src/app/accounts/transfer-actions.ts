'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface LogTransferInput {
  fromAccountId: string
  toAccountId: string
  amount: number
  transferredAt?: string
  note?: string | null
}

export interface ActionResult {
  ok: boolean
  error?: string
}

export async function logTransfer(
  input: LogTransferInput,
): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  if (!input.fromAccountId) return { ok: false, error: 'From account required' }
  if (!input.toAccountId) return { ok: false, error: 'To account required' }
  if (input.fromAccountId === input.toAccountId) {
    return { ok: false, error: 'From and to accounts must differ' }
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: 'Invalid amount' }
  }

  const note = input.note?.trim()

  const { error: insertErr } = await supabase.from('transfers').insert({
    user_id: user.id,
    transferred_at:
      input.transferredAt ?? new Date().toISOString().slice(0, 10),
    from_account_id: input.fromAccountId,
    to_account_id: input.toAccountId,
    amount: input.amount,
    kind: 'manual',
    note: note && note.length > 0 ? note : null,
  })
  if (insertErr) return { ok: false, error: insertErr.message }

  revalidatePath('/accounts')
  revalidatePath('/')
  revalidatePath('/expenses')
  return { ok: true }
}
