'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { parseLenderRouting } from '@/lib/calc'

export interface SyncResult {
  ok: boolean
  error?: string
  /** Map of lender_id → new outstanding, for optimistic UI update. */
  outstanding?: Record<string, number>
}

/**
 * Recompute each lender's `outstanding` as
 *   max(0, principal − Σ routed amounts across every received paycheck).
 *
 * Called after a paycheck's `received` flag or `flow_overrides.lender_routing`
 * changes. Keeps the goal math honest: a paycheck marked received with a
 * $500 routing to Yash immediately shrinks the Yash debt by $500.
 *
 * Idempotent — safe to call after every paycheck save even when nothing about
 * lenders changed. Only writes rows whose outstanding actually shifts, so
 * quiet saves don't ping the lenders table.
 */
export async function syncLenderBalances(): Promise<SyncResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const [lendersRes, paychecksRes] = await Promise.all([
    supabase
      .from('lenders')
      .select('id, principal, outstanding')
      .eq('user_id', user.id),
    supabase
      .from('paychecks')
      .select('flow_overrides, received')
      .eq('user_id', user.id),
  ])
  if (lendersRes.error) return { ok: false, error: lendersRes.error.message }
  if (paychecksRes.error) return { ok: false, error: paychecksRes.error.message }

  const paidByLender = new Map<string, number>()
  for (const p of paychecksRes.data ?? []) {
    if (!p.received) continue
    const routing = parseLenderRouting(p.flow_overrides)
    if (!routing) continue
    for (const [id, amt] of Object.entries(routing)) {
      paidByLender.set(id, (paidByLender.get(id) ?? 0) + amt)
    }
  }

  const outstanding: Record<string, number> = {}
  const updates: Array<{ id: string; outstanding: number }> = []
  for (const l of lendersRes.data ?? []) {
    const principal = Number(l.principal ?? 0)
    const paid = paidByLender.get(l.id) ?? 0
    const next = Math.max(0, principal - paid)
    outstanding[l.id] = next
    if (Math.abs(next - Number(l.outstanding ?? 0)) > 0.005) {
      updates.push({ id: l.id, outstanding: next })
    }
  }

  for (const u of updates) {
    const { error } = await supabase
      .from('lenders')
      .update({ outstanding: u.outstanding, updated_at: new Date().toISOString() })
      .eq('id', u.id)
      .eq('user_id', user.id)
    if (error) return { ok: false, error: error.message }
  }

  if (updates.length > 0) {
    revalidatePath('/')
    revalidatePath('/settings')
    revalidatePath('/paychecks')
  }

  return { ok: true, outstanding }
}
