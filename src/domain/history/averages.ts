export interface DayTotal {
  date: string
  kcal: number
  p: number
  c: number
  f: number
}

export interface AverageResult {
  kcal: number
  p: number
  c: number
  f: number
  daysCounted: number
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Averages only over the days actually present in `days` — callers pass only
 * logged days (a day with no LogEntries simply isn't in the array), so
 * missing days are skipped rather than zero-filled.
 */
export function computeAverage(days: DayTotal[]): AverageResult {
  if (days.length === 0) return { kcal: 0, p: 0, c: 0, f: 0, daysCounted: 0 }

  const sum = days.reduce(
    (acc, d) => ({ kcal: acc.kcal + d.kcal, p: acc.p + d.p, c: acc.c + d.c, f: acc.f + d.f }),
    { kcal: 0, p: 0, c: 0, f: 0 }
  )
  const n = days.length
  return {
    kcal: round1(sum.kcal / n),
    p: round1(sum.p / n),
    c: round1(sum.c / n),
    f: round1(sum.f / n),
    daysCounted: n,
  }
}

/** Group raw log entries into per-day macro totals. Days with zero entries are absent, not zeroed. */
export function groupEntriesByDate<T extends { date: string; kcal: number; p: number; c: number; f: number }>(
  entries: T[]
): DayTotal[] {
  const byDate = new Map<string, DayTotal>()
  for (const entry of entries) {
    const existing = byDate.get(entry.date) ?? { date: entry.date, kcal: 0, p: 0, c: 0, f: 0 }
    existing.kcal += entry.kcal
    existing.p += entry.p
    existing.c += entry.c
    existing.f += entry.f
    byDate.set(entry.date, existing)
  }
  return [...byDate.values()]
    .map((d) => ({ date: d.date, kcal: round1(d.kcal), p: round1(d.p), c: round1(d.c), f: round1(d.f) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
