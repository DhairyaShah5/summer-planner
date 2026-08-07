'use client'

import { createContext, useContext } from 'react'
import type { GoalStatus } from '@/lib/goal-status'

const CTX = createContext<GoalStatus | null>(null)

export function CelebrationContextProvider({
  status,
  children,
}: {
  status: GoalStatus | null
  children: React.ReactNode
}) {
  return <CTX.Provider value={status}>{children}</CTX.Provider>
}

export function useGoalStatus(): GoalStatus | null {
  return useContext(CTX)
}
