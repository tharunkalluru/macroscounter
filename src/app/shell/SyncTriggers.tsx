import { useEffect, useRef } from 'react'
import { runSync } from '../../lib/sync/syncEngine'
import { useUIState } from './UIStateContext'

/**
 * Fires a sync attempt on app open, whenever the browser regains
 * connectivity, and after each log (the existing `dataVersion` signal
 * MealSection/AddFoodSheetContent already bump on every save). Renders
 * nothing — `runSync` itself no-ops for guests and coalesces concurrent
 * calls, so firing it opportunistically here is cheap and safe.
 */
export default function SyncTriggers() {
  const { dataVersion } = useUIState()
  const mountedRef = useRef(false)

  useEffect(() => {
    runSync()
  }, [])

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    runSync()
  }, [dataVersion])

  useEffect(() => {
    function handleOnline() {
      runSync()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  return null
}
