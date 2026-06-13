'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { deriveBudgetFlags, type BudgetKind } from './budget-kind'

export interface AddExpenseInput {
  expense_date: string
  description: string
  amount: number
  category: string
  account_id: string
  budget_kind?: BudgetKind
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

  const flags = deriveBudgetFlags(input.budget_kind ?? 'co')
  const { error: insertErr } = await supabase.from('expenses').insert({
    user_id: user.id,
    expense_date: input.expense_date,
    description: trimmed,
    amount: input.amount,
    category: input.category.trim() || null,
    account_id: input.account_id,
    count_in_co_budget: flags.count_in_co_budget,
    is_personal: flags.is_personal,
  })
  if (insertErr) return { ok: false, error: insertErr.message }

  revalidatePath('/expenses')
  revalidatePath('/')
  revalidatePath('/accounts')
  return { ok: true }
}

export interface UpdateExpenseInput {
  id: string
  expense_date: string
  description: string
  amount: number
  category: string
  account_id: string
  budget_kind: BudgetKind
}

export async function updateExpense(
  input: UpdateExpenseInput,
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  if (!input.id) return { ok: false, error: 'Expense id required' }
  const trimmed = input.description.trim()
  if (!trimmed) return { ok: false, error: 'Description required' }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: 'Invalid amount' }
  }
  if (!input.account_id) return { ok: false, error: 'Account required' }

  const flags = deriveBudgetFlags(input.budget_kind)
  const { error } = await supabase
    .from('expenses')
    .update({
      expense_date: input.expense_date,
      description: trimmed,
      amount: input.amount,
      category: input.category.trim() || null,
      account_id: input.account_id,
      count_in_co_budget: flags.count_in_co_budget,
      is_personal: flags.is_personal,
    })
    .eq('id', input.id)
    .eq('user_id', user.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/expenses')
  revalidatePath('/')
  revalidatePath('/accounts')
  revalidatePath('/weekly')
  return { ok: true }
}

export async function setExpenseBudgetKind(
  expenseId: string,
  kind: BudgetKind,
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const flags = deriveBudgetFlags(kind)
  const { error } = await supabase
    .from('expenses')
    .update({
      count_in_co_budget: flags.count_in_co_budget,
      is_personal: flags.is_personal,
    })
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
