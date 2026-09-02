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

/**
 * The longest run of consecutive logged calendar days anywhere in history —
 * not anchored to a reference date like `computeStreak`, so a broken streak
 * from months ago still counts if it was the longest one. A full scan over
 * every logged date rather than a stored counter, so it can never drift out
 * of sync with the underlying log data (Phase F.5, Habits screen).
 */
export function computeBestStreak(loggedDates: string[]): number {
  if (loggedDates.length === 0) return 0
  const sorted = [...new Set(loggedDates)].sort()
  let best = 1
  let current = 1
  for (let i = 1; i < sorted.length; i++) {
    current = addDaysISO(sorted[i - 1], 1) === sorted[i] ? current + 1 : 1
    best = Math.max(best, current)
  }
  return best
}

const STREAK_MILESTONES = [3, 7, 14, 30, 50, 75, 100]

/**
 * Returns `streak` itself if it's a celebration-worthy milestone (a fixed
 * early progression, then every 50 days once past 100), otherwise `null`.
 */
export function getStreakMilestone(streak: number): number | null {
  if (STREAK_MILESTONES.includes(streak)) return streak
  if (streak > 100 && streak % 50 === 0) return streak
  return null
}

/**
 * First day of the streak currently ending at `referenceDate` (per the same
 * "today still in progress" rule as `computeStreak`), for use as a stable
 * per-run key — e.g. so a milestone celebration fires once per streak run
 * rather than once ever, letting it re-fire after a broken streak rebuilds.
 * Returns null when there's no active streak.
 */
export function computeStreakStartDate(
  loggedDates: string[],
  referenceDate: string,
  streak: number
): string | null {
  if (streak <= 0) return null
  const logged = new Set(loggedDates)
  const end = logged.has(referenceDate) ? referenceDate : addDaysISO(referenceDate, -1)
  return addDaysISO(end, -(streak - 1))
}
