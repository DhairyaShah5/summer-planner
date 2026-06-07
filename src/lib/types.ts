/**
 * Shared domain types for the Summer Planner app.
 *
 * Re-exports the calc engine's input/output types and adds an Expense type
 * matching the Supabase `expenses` table shape.
 */

export type {
  Employer,
  Settings,
  PaycheckInput,
  PaycheckComputed,
} from './calc'

/**
 * Matches the `expenses` table. All fields are strings except `amount`
 * (numeric). Dates are ISO strings from Postgres.
 */
export interface Expense {
  id: string
  expense_date: string
  description: string
  amount: number
  category: string
  account_id: string | null
  count_in_co_budget: boolean
  created_at: string
}
