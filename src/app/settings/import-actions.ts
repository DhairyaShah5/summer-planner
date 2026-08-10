'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { parseWorkbook } from './import-parse'

export type ImportResult = {
  ok: boolean
  settingsImported: boolean
  paychecksImported: number
  error?: string
}

export async function importFromXlsx(formData: FormData): Promise<ImportResult> {
  try {
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return {
        ok: false,
        settingsImported: false,
        paychecksImported: 0,
        error: 'No file provided',
      }
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return {
        ok: false,
        settingsImported: false,
        paychecksImported: 0,
        error: 'Not authenticated',
      }
    }

    const arrayBuffer = await file.arrayBuffer()
    let parsed
    try {
      parsed = parseWorkbook(arrayBuffer)
    } catch (parseErr) {
      const message =
        parseErr instanceof Error ? parseErr.message : 'Failed to parse workbook'
      return {
        ok: false,
        settingsImported: false,
        paychecksImported: 0,
        error: message,
      }
    }

    const { settings, paychecks } = parsed

    // Upsert settings (one row per user, unique by user_id).
    const { error: settingsErr } = await supabase
      .from('settings')
      .upsert(
        { user_id: user.id, ...settings },
        { onConflict: 'user_id' },
      )
    if (settingsErr) {
      return {
        ok: false,
        settingsImported: false,
        paychecksImported: 0,
        error: `Failed to import settings: ${settingsErr.message}`,
      }
    }

    // Replace user's paychecks with the imported set.
    const { error: deleteErr } = await supabase
      .from('paychecks')
      .delete()
      .eq('user_id', user.id)
    if (deleteErr) {
      return {
        ok: false,
        settingsImported: true,
        paychecksImported: 0,
        error: `Failed to clear existing paychecks: ${deleteErr.message}`,
      }
    }

    let paychecksImported = 0
    if (paychecks.length > 0) {
      const rows = paychecks.map((p) => ({
        user_id: user.id,
        pay_num: p.pay_num,
        pay_date: p.pay_date,
        employer: p.employer,
        hours_worked: p.hours_worked,
        actual_net_wages: p.actual_net_wages,
        vault_override: p.vault_override,
        rent_paid: p.rent_paid,
        per_diem: p.per_diem,
        extra_deposit: p.extra_deposit,
        ot_hours: p.ot_hours,
        notes: p.notes,
      }))
      const { error: insertErr, count } = await supabase
        .from('paychecks')
        .insert(rows, { count: 'exact' })
      if (insertErr) {
        return {
          ok: false,
          settingsImported: true,
          paychecksImported: 0,
          error: `Failed to insert paychecks: ${insertErr.message}`,
        }
      }
      paychecksImported = count ?? paychecks.length
    }

    revalidatePath('/settings')
    revalidatePath('/paychecks')
    revalidatePath('/weekly')
    revalidatePath('/')

    return {
      ok: true,
      settingsImported: true,
      paychecksImported,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      ok: false,
      settingsImported: false,
      paychecksImported: 0,
      error: message,
    }
  }
}
