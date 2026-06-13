// Pure helpers + types for the 3-way expense budget treatment. Lives in a
// non-server module so both client components and the 'use server' actions
// can import without violating Next's restriction that server modules export
// only async functions.

export type BudgetKind = 'co' | 'reimbursable' | 'personal'

export function deriveBudgetFlags(kind: BudgetKind): {
  count_in_co_budget: boolean
  is_personal: boolean
} {
  if (kind === 'co') return { count_in_co_budget: true, is_personal: false }
  if (kind === 'reimbursable')
    return { count_in_co_budget: false, is_personal: false }
  return { count_in_co_budget: false, is_personal: true }
}

export function classifyBudgetKind(e: {
  count_in_co_budget?: boolean | null
  is_personal?: boolean | null
}): BudgetKind {
  if (e.is_personal === true) return 'personal'
  if (e.count_in_co_budget === false) return 'reimbursable'
  return 'co'
}
