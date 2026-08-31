export interface ReportDayTotal {
  date: string
  kcal: number
  p: number
}

export interface WeeklyReport {
  avgKcal: number
  proteinHitRate: number
  bestDay: { date: string; kcal: number } | null
  worstDay: { date: string; kcal: number } | null
  daysCounted: number
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * avgKcal / proteinHitRate (fraction of days protein target was met) are
 * computed only over the days actually passed in (unlogged days are simply
 * absent from `days`, same "skip don't zero-fill" convention as Phase 4's
 * averages). Best/worst day are whichever have the smallest/largest absolute
 * deviation from the kcal target.
 */
export function computeWeeklyReport(
  days: ReportDayTotal[],
  target: { kcal: number; proteinG: number }
): WeeklyReport {
  if (days.length === 0) {
    return { avgKcal: 0, proteinHitRate: 0, bestDay: null, worstDay: null, daysCounted: 0 }
  }

  const avgKcal = round1(days.reduce((sum, d) => sum + d.kcal, 0) / days.length)
  const hitCount = days.filter((d) => d.p >= target.proteinG).length
  const proteinHitRate = round2(hitCount / days.length)

  const byDeviation = [...days].sort(
    (a, b) => Math.abs(a.kcal - target.kcal) - Math.abs(b.kcal - target.kcal)
  )
  const best = byDeviation[0]
  const worst = byDeviation[byDeviation.length - 1]

  return {
    avgKcal,
    proteinHitRate,
    bestDay: { date: best.date, kcal: best.kcal },
    worstDay: { date: worst.date, kcal: worst.kcal },
    daysCounted: days.length,
  }
}

export interface WeekComparison {
  /** false when the prior week has no logged days at all — nothing to compare against yet. */
  hasPreviousData: boolean
  avgKcalDelta: number
  /** null when hasPreviousData is false. Whether this week's avg kcal sits nearer the target than last week's did. */
  kcalCloserToTarget: boolean | null
  proteinHitRateDelta: number
}

/**
 * "Closer to target" (not just up/down) is what actually matters for calories,
 * since up or down alone doesn't say whether the user is over- or under-eating
 * relative to their goal.
 */
export function compareWeeklyReports(
  current: WeeklyReport,
  previous: WeeklyReport,
  targetKcal: number
): WeekComparison {
  if (previous.daysCounted === 0) {
    return {
      hasPreviousData: false,
      avgKcalDelta: 0,
      kcalCloserToTarget: null,
      proteinHitRateDelta: 0,
    }
  }

  const currentDeviation = Math.abs(current.avgKcal - targetKcal)
  const previousDeviation = Math.abs(previous.avgKcal - targetKcal)

  return {
    hasPreviousData: true,
    avgKcalDelta: round1(current.avgKcal - previous.avgKcal),
    kcalCloserToTarget: currentDeviation < previousDeviation,
    proteinHitRateDelta: round2(current.proteinHitRate - previous.proteinHitRate),
  }
}
