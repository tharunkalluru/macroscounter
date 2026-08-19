/* eslint-disable react-refresh/only-export-components -- context + hook are colocated by design */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Meal } from '../../data/models'

interface AddFoodSheetState {
  open: boolean
  meal: Meal
  /** Jump straight to the barcode scanner instead of the search screen. */
  startOnScan: boolean
}

interface UIStateValue {
  addFoodSheet: AddFoodSheetState
  openAddFoodSheet: (meal?: Meal, options?: { startOnScan?: boolean }) => void
  closeAddFoodSheet: () => void
  /** Bumped whenever a log entry is saved from a sheet, so pages showing today's log know to re-fetch. */
  dataVersion: number
  notifyDataChanged: () => void
}

const UIStateContext = createContext<UIStateValue | null>(null)

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [addFoodSheet, setAddFoodSheet] = useState<AddFoodSheetState>({
    open: false,
    meal: 'breakfast',
    startOnScan: false,
  })
  const [dataVersion, setDataVersion] = useState(0)

  const openAddFoodSheet = useCallback((meal: Meal = 'breakfast', options?: { startOnScan?: boolean }) => {
    setAddFoodSheet({ open: true, meal, startOnScan: options?.startOnScan ?? false })
  }, [])

  const closeAddFoodSheet = useCallback(() => {
    setAddFoodSheet((prev) => ({ ...prev, open: false }))
  }, [])

  const notifyDataChanged = useCallback(() => {
    setDataVersion((v) => v + 1)
  }, [])

  const value = useMemo(
    () => ({ addFoodSheet, openAddFoodSheet, closeAddFoodSheet, dataVersion, notifyDataChanged }),
    [addFoodSheet, openAddFoodSheet, closeAddFoodSheet, dataVersion, notifyDataChanged]
  )

  return <UIStateContext.Provider value={value}>{children}</UIStateContext.Provider>
}

export function useUIState(): UIStateValue {
  const ctx = useContext(UIStateContext)
  if (!ctx) throw new Error('useUIState must be used within a UIStateProvider')
  return ctx
}
