'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isViewMode, viewOnlyError } from '@/lib/view-mode'

export interface RolloverSweepInput {
  fromAccountId: string
  toAccountId: string
  amount: number
  transferredAt?: string
}

export interface ActionResult {
  ok: boolean
  error?: string
}

export async function logRolloverSweep(
  input: RolloverSweepInput,
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

  const { error: insertErr } = await supabase.from('transfers').insert({
    user_id: user.id,
    transferred_at:
      input.transferredAt ?? new Date().toISOString().slice(0, 10),
    from_account_id: input.fromAccountId,
    to_account_id: input.toAccountId,
    amount: input.amount,
    kind: 'rollover_sweep',
    note: 'Weekly CO rollover sweep',
  })
  if (insertErr) return { ok: false, error: insertErr.message }

  revalidatePath('/weekly')
  revalidatePath('/accounts')
  revalidatePath('/')
  return { ok: true }
}

export interface BufferSweepInput {
  fromAccountId: string
  toAccountId: string
  amount: number
  transferredAt?: string
}

export async function logBufferSweep(
  input: BufferSweepInput,
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

  const { error: insertErr } = await supabase.from('transfers').insert({
    user_id: user.id,
    transferred_at:
      input.transferredAt ?? new Date().toISOString().slice(0, 10),
    from_account_id: input.fromAccountId,
    to_account_id: input.toAccountId,
    amount: input.amount,
    kind: 'buffer_sweep',
    note: 'Chase buffer → Marcus HYSA',
  })
  if (insertErr) return { ok: false, error: insertErr.message }

  revalidatePath('/weekly')
  revalidatePath('/accounts')
  revalidatePath('/')
  return { ok: true }
}

export interface VaultTopupSweepInput {
  fromAccountId: string
  toAccountId: string
  amount: number
  transferredAt?: string
}

export async function logVaultTopupSweep(
  input: VaultTopupSweepInput,
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

  const { error: insertErr } = await supabase.from('transfers').insert({
    user_id: user.id,
    transferred_at:
      input.transferredAt ?? new Date().toISOString().slice(0, 10),
    from_account_id: input.fromAccountId,
    to_account_id: input.toAccountId,
    amount: input.amount,
    kind: 'vault_topup_sweep',
    note: 'BofA wages → Vault top-up',
  })
  if (insertErr) return { ok: false, error: insertErr.message }

  revalidatePath('/')
  revalidatePath('/accounts')
  revalidatePath('/weekly')
  return { ok: true }
}
