'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TABLES = [
  'paychecks',
  'expenses',
  'settings',
  'accounts',
  'account_entries',
  'cc_payments',
  'transfers',
] as const

export function useRealtimeSync() {
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let debounceTimer: number | null = null

    const scheduleRefresh = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => {
        queryClient.invalidateQueries()
        router.refresh()
      }, 300)
    }

    const subscribe = (accessToken: string) => {
      supabase.realtime.setAuth(accessToken)
      const ch = supabase.channel('summer-planner-sync')
      for (const table of TABLES) {
        ch.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          scheduleRefresh,
        )
      }
      ch.subscribe()
      channel = ch
    }

    const unsubscribe = () => {
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) subscribe(data.session.access_token)
    })

    const { data: authSub } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        unsubscribe()
        if (session) subscribe(session.access_token)
      },
    )

    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer)
      authSub.subscription.unsubscribe()
      unsubscribe()
    }
  }, [queryClient, router])
}

export function RealtimeSync() {
  useRealtimeSync()
  return null
}
