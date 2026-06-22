'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isViewMode, viewOnlyError } from '@/lib/view-mode'

export interface PayCreditCardInput {
  fromAccountId: string
  toAccountId: string
  amount: number
  paidAt?: string
  kind?: 'payment' | 'refund_claim'
}

export interface ActionResult {
  ok: boolean
  error?: string
}

export async function payCreditCard(
  input: PayCreditCardInput,
): Promise<ActionResult> {
  if (await isViewMode()) return viewOnlyError()
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

  const { error: insertErr } = await supabase.from('cc_payments').insert({
    user_id: user.id,
    paid_at: input.paidAt ?? new Date().toISOString().slice(0, 10),
    from_account_id: input.fromAccountId,
    to_account_id: input.toAccountId,
    amount: input.amount,
    kind: input.kind ?? 'payment',
  })
  if (insertErr) return { ok: false, error: insertErr.message }

  revalidatePath('/accounts')
  revalidatePath('/')
  revalidatePath('/expenses')
  return { ok: true }
}
