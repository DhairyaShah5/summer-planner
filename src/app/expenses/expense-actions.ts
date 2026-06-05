'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface AddExpenseInput {
  expense_date: string
  description: string
  amount: number
  category: string
  account_id: string
}

export interface ActionResult {
  ok: boolean
  error?: string
}

/**
 * Apply a balance delta to an account based on its type and the expense amount.
 *
 * For credit cards, an expense INCREASES the outstanding balance (we owe more).
 * For checking / hysa, an expense DECREASES the balance (we have less cash).
 *
 * `direction` is +1 for "applying" the expense and -1 for "reversing" it (delete).
 */
async function adjustAccountBalance(
  accountId: string,
  amount: number,
  direction: 1 | -1,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: acct, error: fetchErr } = await supabase
    .from('accounts')
    .select('id, type, current_balance')
    .eq('id', accountId)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }
  if (!acct) return { error: 'Account not found' }

  const sign = acct.type === 'credit_card' ? 1 : -1
  const delta = sign * direction * amount
  const next = Number(acct.current_balance) + delta

  const { error: updErr } = await supabase
    .from('accounts')
    .update({ current_balance: next })
    .eq('id', accountId)
  if (updErr) return { error: updErr.message }
  return {}
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
  })
  if (insertErr) return { ok: false, error: insertErr.message }

  const balanceRes = await adjustAccountBalance(input.account_id, input.amount, 1)
  if (balanceRes.error) {
    // Soft-fail: the expense is recorded; the balance update failed.
    // Caller still gets ok=false so they can surface the issue.
    return { ok: false, error: `Expense saved but balance not updated: ${balanceRes.error}` }
  }

  revalidatePath('/expenses')
  revalidatePath('/')
  revalidatePath('/accounts')
  return { ok: true }
}

export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const { data: expense, error: fetchErr } = await supabase
    .from('expenses')
    .select('id, amount, account_id')
    .eq('id', expenseId)
    .maybeSingle()
  if (fetchErr) return { ok: false, error: fetchErr.message }
  if (!expense) return { ok: false, error: 'Expense not found' }

  const { error: delErr } = await supabase.from('expenses').delete().eq('id', expenseId)
  if (delErr) return { ok: false, error: delErr.message }

  if (expense.account_id) {
    const balanceRes = await adjustAccountBalance(
      expense.account_id,
      Number(expense.amount),
      -1,
    )
    if (balanceRes.error) {
      return { ok: false, error: `Expense deleted but balance not reversed: ${balanceRes.error}` }
    }
  }

  revalidatePath('/expenses')
  revalidatePath('/')
  revalidatePath('/accounts')
  return { ok: true }
}
