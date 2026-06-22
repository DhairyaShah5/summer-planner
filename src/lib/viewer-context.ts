import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isViewMode, getOwnerUserId } from '@/lib/view-mode'
import type { Database } from '@/lib/database.types'

export interface ViewerContext {
  supabase: SupabaseClient<Database>
  userId: string
  viewMode: boolean
}

/**
 * Returns the supabase client + effective user id for the current request.
 *
 * - Auth'd user: returns their session client and their user.id (viewMode=false)
 * - View mode:   returns a service-role client and the owner user_id from env
 *                (viewMode=true)
 * - Unauth + no view mode: redirects to /login (this function never returns)
 */
export async function getViewerContext(): Promise<ViewerContext> {
  if (await isViewMode()) {
    return {
      supabase: createServiceClient(),
      userId: getOwnerUserId(),
      viewMode: true,
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, userId: user.id, viewMode: false }
}
