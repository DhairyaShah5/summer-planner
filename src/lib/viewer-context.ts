import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

export interface ViewerContext {
  supabase: SupabaseClient<Database>
  userId: string
}

/**
 * Returns the Supabase server client + the current user id.
 * The proxy guarantees the caller is authenticated before any route
 * reaches this, so an unauth request would never land here.
 */
export async function getViewerContext(): Promise<ViewerContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('getViewerContext: no authenticated user')
  }
  return { supabase, userId: user.id }
}
