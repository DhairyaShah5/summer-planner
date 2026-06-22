'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isViewMode, viewOnlyError } from '@/lib/view-mode'

export async function updateNetWorthInclusion(
  selections: Array<{ id: string; include: boolean }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!selections.length) return { ok: true }
  if (await isViewMode()) return viewOnlyError()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in' }

  for (const sel of selections) {
    const { error } = await supabase
      .from('accounts')
      .update({ include_in_net_worth: sel.include })
      .eq('id', sel.id)
      .eq('user_id', user.id)
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath('/accounts')
  revalidatePath('/')
  return { ok: true }
}
