import { useEffect, useRef } from 'react'
import { onSyncDataChanged, runSync } from '../../lib/sync/syncEngine'
import { useUIState } from './UIStateContext'

/** How often to pull while the app is open and visible. */
const POLL_MS = 60_000

/**
 * Fires a sync attempt on app open, whenever the browser regains
 * connectivity, after each log (the existing `dataVersion` signal
 * MealSection/AddFoodSheetContent already bump on every save), whenever the
 * tab becomes visible again, and on a slow poll while it stays visible.
 *
 * The last two are what make a second device actually converge: without
 * them nothing ever *pulls* on a device that's sitting open but not being
 * typed into, so a meal logged on your phone would only show up on your
 * laptop after a manual reload. Renders nothing — `runSync` no-ops for
 * guests and coalesces concurrent calls, so firing it opportunistically is
 * cheap and safe.
 */
export default function SyncTriggers() {
  const { dataVersion, notifyDataChanged } = useUIState()
  const mountedRef = useRef(false)

  // A pull that merged rows has to tell the screens to re-read, or the new
  // data sits in IndexedDB unseen until the next navigation.
  useEffect(() => onSyncDataChanged(notifyDataChanged), [notifyDataChanged])

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
    function handleVisibility() {
      if (document.visibilityState === 'visible') runSync()
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOnline)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      // Skip while hidden — visibilitychange above covers the catch-up when
      // the tab comes back, so polling a backgrounded tab is pure waste.
      if (document.visibilityState === 'visible') runSync()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [])

  return null
}
