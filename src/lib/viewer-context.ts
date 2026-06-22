import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isViewMode } from '@/lib/view-mode'
import type { Database } from '@/lib/database.types'

export interface ViewerContext {
  supabase: SupabaseClient<Database>
  userId: string
  viewMode: boolean
}

let cachedOwnerUserId: string | null = null

/**
 * Single-user app — discover the owner's user_id from any existing row.
 * Cached in-process so each request that hits view mode only pays for
 * the discovery once per cold start.
 */
async function discoverOwnerUserId(
  supabase: SupabaseClient<Database>,
): Promise<string> {
  if (cachedOwnerUserId) return cachedOwnerUserId
  const { data, error } = await supabase
    .from('settings')
    .select('user_id')
    .limit(1)
    .maybeSingle()
  if (error) {
    throw new Error(`View mode: could not look up owner — ${error.message}`)
  }
  if (!data?.user_id) {
    throw new Error(
      'View mode: no settings row exists yet, so there is no owner to view.',
    )
  }
  cachedOwnerUserId = data.user_id as string
  return cachedOwnerUserId
}

/**
 * Returns the supabase client + effective user id for the current request.
 *
 * - Auth'd user: returns their session client and their user.id (viewMode=false)
 * - Otherwise:   returns a service-role client and the owner user_id
 *                (discovered from the settings table) (viewMode=true)
 */
export async function getViewerContext(): Promise<ViewerContext> {
  if (!(await isViewMode())) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) return { supabase, userId: user.id, viewMode: false }
  }

  const serviceClient = createServiceClient()
  const userId = await discoverOwnerUserId(serviceClient)
  return { supabase: serviceClient, userId, viewMode: true }
}
