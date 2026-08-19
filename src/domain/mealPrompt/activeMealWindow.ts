import type { Meal } from '../../data/models'

/**
 * Which meal window a local clock time falls in, per the phase-10 spec:
 * Breakfast 5:00–10:59, Lunch 11:00–15:29, Snacks 15:30–18:29,
 * Dinner 18:30–23:59. Returns null for 00:00–4:59 (no prompt overnight).
 */
export function activeMealWindow(date: Date): Meal | null {
  const minutes = date.getHours() * 60 + date.getMinutes()

  if (minutes >= 5 * 60 && minutes < 11 * 60) return 'breakfast'
  if (minutes >= 11 * 60 && minutes < 15 * 60 + 30) return 'lunch'
  if (minutes >= 15 * 60 + 30 && minutes < 18 * 60 + 30) return 'snacks'
  if (minutes >= 18 * 60 + 30 && minutes < 24 * 60) return 'dinner'
  return null
}
