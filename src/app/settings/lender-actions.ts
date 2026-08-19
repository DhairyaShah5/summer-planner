'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export interface LenderActionResult {
  ok: boolean
  error?: string
}

interface UpsertLenderInput {
  id?: string
  name: string
  principal: number
  outstanding: number
  note?: string | null
}

function refresh() {
  revalidatePath('/')
  revalidatePath('/settings')
  revalidatePath('/paychecks')
}

export async function upsertLender(
  input: UpsertLenderInput,
): Promise<LenderActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const name = input.name?.trim()
  if (!name) return { ok: false, error: 'Name required' }
  if (!Number.isFinite(input.principal) || input.principal < 0) {
    return { ok: false, error: 'Principal must be zero or positive' }
  }
  if (!Number.isFinite(input.outstanding) || input.outstanding < 0) {
    return { ok: false, error: 'Outstanding must be zero or positive' }
  }
  const note = input.note?.trim()

  if (input.id) {
    const { error } = await supabase
      .from('lenders')
      .update({
        name,
        principal: input.principal,
        outstanding: input.outstanding,
        note: note && note.length > 0 ? note : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .eq('user_id', user.id)
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await supabase.from('lenders').insert({
      user_id: user.id,
      name,
      principal: input.principal,
      outstanding: input.outstanding,
      note: note && note.length > 0 ? note : null,
    })
    if (error) return { ok: false, error: error.message }
  }

  refresh()
  return { ok: true }
}

export async function deleteLender(id: string): Promise<LenderActionResult> {
  if (!id) return { ok: false, error: 'Lender id required' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  const { error } = await supabase
    .from('lenders')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) return { ok: false, error: error.message }

  refresh()
  return { ok: true }
}
