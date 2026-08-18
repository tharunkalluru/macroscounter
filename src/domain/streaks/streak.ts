import { addDaysISO } from '../../lib/date'

/**
 * Consecutive logged days ending at `referenceDate`. If `referenceDate`
 * itself has no entries yet (the day is still in progress), counting starts
 * from the day before instead — one day with nothing logged *yet* shouldn't
 * zero out an otherwise-unbroken streak.
 */
export function computeStreak(loggedDates: string[], referenceDate: string): number {
  const logged = new Set(loggedDates)
  let cursor = logged.has(referenceDate) ? referenceDate : addDaysISO(referenceDate, -1)
  let streak = 0
  while (logged.has(cursor)) {
    streak++
    cursor = addDaysISO(cursor, -1)
  }
  return streak
}

/** Fraction (0..1) of the last `windowDays` days (inclusive of referenceDate) that have >=1 entry. */
export function computeConsistency(loggedDates: string[], referenceDate: string, windowDays = 30): number {
  const logged = new Set(loggedDates)
  let count = 0
  for (let i = 0; i < windowDays; i++) {
    if (logged.has(addDaysISO(referenceDate, -i))) count++
  }
  return count / windowDays
}
