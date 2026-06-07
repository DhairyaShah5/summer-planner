'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface AddExpenseInput {
  expense_date: string
  description: string
  amount: number
  category: string
  account_id: string
  count_in_co_budget?: boolean
}

export interface ActionResult {
  ok: boolean
  error?: string
}

export async function addExpense(input: AddExpenseInput): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const trimmed = input.description.trim()
  if (!trimmed) return { ok: false, error: 'Description required' }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: 'Invalid amount' }
  }
  if (!input.account_id) return { ok: false, error: 'Account required' }

  const { error: insertErr } = await supabase.from('expenses').insert({
    user_id: user.id,
    expense_date: input.expense_date,
    description: trimmed,
    amount: input.amount,
    category: input.category.trim() || null,
    account_id: input.account_id,
    count_in_co_budget: input.count_in_co_budget ?? true,
  })
  if (insertErr) return { ok: false, error: insertErr.message }

  revalidatePath('/expenses')
  revalidatePath('/')
  revalidatePath('/accounts')
  return { ok: true }
}

export async function toggleReimbursable(
  expenseId: string,
  reimbursable: boolean,
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const { error } = await supabase
    .from('expenses')
    .update({ count_in_co_budget: !reimbursable })
    .eq('id', expenseId)
    .eq('user_id', user.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/expenses')
  revalidatePath('/')
  revalidatePath('/accounts')
  revalidatePath('/weekly')
  return { ok: true }
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const { error: delErr } = await supabase.from('expenses').delete().eq('id', expenseId)
  if (delErr) return { ok: false, error: delErr.message }

  revalidatePath('/expenses')
  revalidatePath('/')
  revalidatePath('/accounts')
  return { ok: true }
}
