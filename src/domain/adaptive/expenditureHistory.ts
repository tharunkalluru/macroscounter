import { addDaysISO } from '../../lib/date'
import { computeAdaptiveAdjustment, type DayKcal, type WeighInPoint } from './adaptiveTargets'

export interface ExpenditureWeekPoint {
  /** The Monday-anchored end date of this trailing 7-day window. */
  weekEndDate: string
  impliedTDEE: number
  meanLoggedKcal: number
}

/**
 * Walks backward from `referenceDate` in non-overlapping 7-day windows,
 * reusing `computeAdaptiveAdjustment`'s existing measured-TDEE math for each
 * one, to produce a multi-week expenditure series (frame 27's chart and
 * "since Week 1" delta) — nothing new is persisted; every point is derived
 * fresh from the same raw logs/weigh-ins each time this runs. A week with
 * fewer than 7 logged days or fewer than 2 weigh-ins (computeAdaptiveAdjustment
 * returns null) is simply absent from the result, the same "not enough data
 * yet" degradation the single-window version already has.
 */
export function computeExpenditureHistory(params: {
  loggedDays: DayKcal[]
  weighIns: WeighInPoint[]
  referenceDate: string
  weeks?: number
}): ExpenditureWeekPoint[] {
  const weeks = params.weeks ?? 6
  const points: ExpenditureWeekPoint[] = []

  for (let i = weeks - 1; i >= 0; i--) {
    const weekEndDate = addDaysISO(params.referenceDate, -7 * i)
    const result = computeAdaptiveAdjustment({
      loggedDays: params.loggedDays,
      weighIns: params.weighIns,
      currentTargetKcal: 0,
      floorKcal: 0,
      referenceDate: weekEndDate,
    })
    if (!result) continue
    points.push({ weekEndDate, impliedTDEE: result.impliedTDEE, meanLoggedKcal: result.meanLoggedKcal })
  }

  return points
}
