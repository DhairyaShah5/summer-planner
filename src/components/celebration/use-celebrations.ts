'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type CelebrationMode = 'full' | 'badge' | 'off'

const MODE_KEY = 'celebrations.mode.v1'
const SEEN_KEY = 'celebrations.reveal-seen.v1'

const DEFAULT_MODE: CelebrationMode = 'full'

function readMode(): CelebrationMode {
  if (typeof window === 'undefined') return DEFAULT_MODE
  const raw = window.localStorage.getItem(MODE_KEY)
  if (raw === 'full' || raw === 'badge' || raw === 'off') return raw
  return DEFAULT_MODE
}

function readSeen(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(SEEN_KEY) === '1'
}

type Listener = () => void
const listeners = new Set<Listener>()

function subscribe(l: Listener) {
  listeners.add(l)
  const onStorage = (e: StorageEvent) => {
    if (e.key === MODE_KEY || e.key === SEEN_KEY) l()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(l)
    window.removeEventListener('storage', onStorage)
  }
}

function notify() {
  for (const l of listeners) l()
}

export function useCelebrationMode(): [CelebrationMode, (m: CelebrationMode) => void] {
  const mode = useSyncExternalStore(
    subscribe,
    () => readMode(),
    () => DEFAULT_MODE,
  )
  const setMode = useCallback((m: CelebrationMode) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(MODE_KEY, m)
    notify()
  }, [])
  return [mode, setMode]
}

export function useRevealSeen(): [boolean, { markSeen: () => void; reset: () => void }] {
  const seen = useSyncExternalStore(
    subscribe,
    () => readSeen(),
    () => false,
  )
  const markSeen = useCallback(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(SEEN_KEY, '1')
    notify()
  }, [])
  const reset = useCallback(() => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(SEEN_KEY)
    notify()
  }, [])
  return [seen, { markSeen, reset }]
}

// One-per-tab ambient burst gate. Session-scoped so navigating between pages
// doesn't spam confetti; a fresh tab replays it once.
const AMBIENT_KEY = 'celebrations.ambient-fired.v1'

export function useAmbientOnce(fire: () => void, ready: boolean) {
  useEffect(() => {
    if (!ready) return
    if (typeof window === 'undefined') return
    if (window.sessionStorage.getItem(AMBIENT_KEY) === '1') return
    window.sessionStorage.setItem(AMBIENT_KEY, '1')
    const id = window.setTimeout(fire, 700)
    return () => window.clearTimeout(id)
  }, [ready, fire])
}

export function resetAmbient() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(AMBIENT_KEY)
}
