export interface DayHabit {
  date: string
  loggedWeighIn: boolean
  /** 0..1, clamped — how much of the protein target that day's logged intake covered. */
  proteinHitRate: number
}

/**
 * Per-day habit completion for the trailing window (Habits screen's
 * weigh-in-completion grid + protein bar chart) — a thin aggregation over
 * data the app already tracks (WeighIn dates, per-day protein totals), no
 * new data model.
 */
export function computeHabitsWeek(
  days: string[],
  weighInDates: ReadonlySet<string>,
  proteinByDate: ReadonlyMap<string, number>,
  proteinTargetG: number
): DayHabit[] {
  return days.map((date) => ({
    date,
    loggedWeighIn: weighInDates.has(date),
    proteinHitRate: proteinTargetG > 0 ? Math.min(1, (proteinByDate.get(date) ?? 0) / proteinTargetG) : 0,
  }))
}
