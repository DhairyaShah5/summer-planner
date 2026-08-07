'use client'

import { useCallback, useEffect } from 'react'
import {
  CelebrationContextProvider,
  useGoalStatus,
} from './celebration-context'
import { GoalReachedModal } from './goal-reached-modal'
import {
  resetAmbient,
  useAmbientOnce,
  useCelebrationMode,
  useRevealSeen,
} from './use-celebrations'
import { ambientBurst, startEndlessFall } from './confetti'
import type { GoalStatus } from '@/lib/goal-status'

export function CelebrationProvider({
  status,
  children,
}: {
  status: GoalStatus
  children: React.ReactNode
}) {
  return (
    <CelebrationContextProvider status={status}>
      {children}
      <CelebrationEffects />
    </CelebrationContextProvider>
  )
}

function CelebrationEffects() {
  const [mode] = useCelebrationMode()
  const [seen, { markSeen, reset }] = useRevealSeen()
  const status = useGoalStatus()

  // Each time the vault crosses the cap, the reveal should feel first-time
  // again. Clearing `seen` (and the per-tab ambient gate) whenever the goal
  // isn't currently reached means the next crossing re-fires the modal +
  // ambient burst — mirroring how the user tests by unchecking future
  // paychecks and re-checking them as they arrive.
  useEffect(() => {
    if (!status?.isReached && seen) {
      reset()
      resetAmbient()
    }
  }, [status?.isReached, seen, reset])

  const ambientReady = !!status?.isReached && mode === 'full' && seen
  useAmbientOnce(ambientBurst, ambientReady)

  // Endless snowfall while the goal is met AND the user hasn't opted out.
  // Cleans up automatically when they toggle to 'badge'/'off' or drop below
  // the cap (which auto-unsets `seen` above).
  useEffect(() => {
    if (!status?.isReached) return
    if (mode !== 'full') return
    const stop = startEndlessFall()
    return stop
  }, [status?.isReached, mode])

  // Root-level goal flag so vault-facing tiles can opt into gold treatment
  // without prop-drilling. Cleared to "false" when off so unrelated targets
  // that key off `[data-goal-reached="true"]` return to their normal look.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const on = !!status?.isReached && mode !== 'off'
    document.documentElement.dataset.goalReached = on ? 'true' : 'false'
    return () => {
      document.documentElement.removeAttribute('data-goal-reached')
    }
  }, [status?.isReached, mode])

  const onClose = useCallback(() => {
    markSeen()
  }, [markSeen])

  if (!status?.isReached) return null
  if (mode === 'off') return null
  return (
    <GoalReachedModal
      open={!seen}
      cap={status.cap}
      current={status.current}
      paycheckContributions={status.paycheckContributions}
      daysUntilDeadline={status.daysUntilDeadline}
      deadlineISO={status.deadlineISO}
      onClose={onClose}
    />
  )
}
