export interface DayProteinPoint {
  /** 0 = Monday .. 6 = Sunday */
  weekday: number
  hitRate: number
}

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/**
 * A single personalized "this week's focus" line for the check-in wizard's
 * closing message (frame 31) — the weekday whose protein hit-rate lagged
 * furthest behind the week's average, in plain language. Returns null when
 * there isn't a meaningful gap (every day was roughly the same).
 */
export function computeWeeklyFocusTip(days: DayProteinPoint[]): string | null {
  if (days.length === 0) return null
  const avg = days.reduce((sum, d) => sum + d.hitRate, 0) / days.length
  const worst = [...days].sort((a, b) => a.hitRate - b.hitRate)[0]
  if (avg - worst.hitRate < 0.15) return null
  return `Protein on ${WEEKDAY_NAMES[worst.weekday]} is your weak spot this week - worth planning ahead for it.`
}
