import { useEffect, useRef, useState } from 'react'
import type { LogEntry, Meal } from '../../data/models'
import { activeMealWindow } from '../../domain/mealPrompt/activeMealWindow'
import { todayISO } from '../../lib/date'
import { dismissMealPrompt, isMealPromptDismissed } from '../../lib/mealPrompt/dismissal'

const BACKGROUND_THRESHOLD_MS = 45 * 60 * 1000

export interface MealPromptControls {
  /** The meal to prompt for, or null if nothing should show right now. */
  meal: Meal | null
  /** "Not now" — suppresses this meal window for the rest of the day. */
  dismiss: () => void
  /** Hides the sheet without persisting a dismissal (Search/Scan handed off, or just logged). */
  close: () => void
}

/**
 * Drives the time-aware meal prompt: shows on mount ("app open") and again
 * whenever the tab regains visibility after being hidden for more than 45
 * minutes ("returning from background"), if the current meal window has no
 * entries yet today and hasn't already been dismissed today.
 */
export function useMealPrompt(todayEntries: LogEntry[], enabled: boolean): MealPromptControls {
  const [meal, setMeal] = useState<Meal | null>(null)
  const hiddenAtRef = useRef<number | null>(null)

  function evaluate() {
    if (!enabled) {
      setMeal(null)
      return
    }
    const window = activeMealWindow(new Date())
    if (!window) {
      setMeal(null)
      return
    }
    const date = todayISO()
    if (isMealPromptDismissed(date, window)) {
      setMeal(null)
      return
    }
    const hasEntry = todayEntries.some((e) => e.meal === window)
    setMeal(hasEntry ? null : window)
  }

  useEffect(() => {
    evaluate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayEntries, enabled])

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }
      const hiddenAt = hiddenAtRef.current
      hiddenAtRef.current = null
      if (hiddenAt !== null && Date.now() - hiddenAt < BACKGROUND_THRESHOLD_MS) return
      evaluate()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayEntries, enabled])

  function dismiss() {
    if (!meal) return
    dismissMealPrompt(todayISO(), meal)
    setMeal(null)
  }

  function close() {
    setMeal(null)
  }

  return { meal, dismiss, close }
}
