// Single source of truth for expense category labels + their donut/chip hue.
// IDs are the human-readable strings stored in `expenses.category` so the
// donut and tags pick up the right tint even on existing rows.
export interface ExpenseCategory {
  id: string
  hue: number
}

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  { id: 'Eating Out', hue: 25 },
  { id: 'Groceries', hue: 150 },
  { id: 'Personal Care', hue: 330 },
  { id: 'Transport', hue: 235 },
  { id: 'Entertainment', hue: 295 },
  { id: 'Shopping', hue: 60 },
  { id: 'Bills & Utilities', hue: 200 },
  { id: 'Health', hue: 175 },
  { id: 'Subscriptions', hue: 270 },
  { id: 'Other', hue: 90 },
] as const

const FALLBACK_HUE = 90

export function hueForCategory(category: string | null | undefined): number {
  const trimmed = (category ?? '').trim()
  if (!trimmed) return FALLBACK_HUE
  const match = EXPENSE_CATEGORIES.find(
    (c) => c.id.toLowerCase() === trimmed.toLowerCase(),
  )
  return match?.hue ?? FALLBACK_HUE
}
