'use client'

import { createContext, useContext } from 'react'

const ViewModeContext = createContext(false)

export function ViewModeProvider({
  viewMode,
  children,
}: {
  viewMode: boolean
  children: React.ReactNode
}) {
  return (
    <ViewModeContext.Provider value={viewMode}>
      {children}
    </ViewModeContext.Provider>
  )
}

export function useViewMode(): boolean {
  return useContext(ViewModeContext)
}
