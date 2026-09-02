import { kgToLb } from '../units/weight'

export interface GoalReachedStats {
  lbLost: number
  lbPerWeekAvg: number
  daysLoggedPct: number
  weeksElapsed: number
  totalLoggedDays: number
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / msPerDay)
}

/**
 * Lifetime stats for the goal-reached takeover (frame 33) — all derived
 * from existing weigh-in/log history, nothing new persisted. `firstWeighIn`
 * and `latestWeighIn` should be the earliest/latest points of the same
 * trend series `projectGoalWeight` already confirmed is "at goal".
 */
export function computeGoalReachedStats(params: {
  firstWeightKg: number
  latestWeightKg: number
  firstWeighInDate: string
  latestWeighInDate: string
  totalLoggedDays: number
}): GoalReachedStats {
  const spanDays = Math.max(1, daysBetween(params.firstWeighInDate, params.latestWeighInDate))
  const weeksElapsed = Math.max(1, Math.round(spanDays / 7))
  const lbLost = Math.round((kgToLb(params.firstWeightKg) - kgToLb(params.latestWeightKg)) * 10) / 10
  const lbPerWeekAvg = Math.round((lbLost / weeksElapsed) * 100) / 100
  const daysLoggedPct = Math.round((params.totalLoggedDays / spanDays) * 100)

  return {
    lbLost,
    lbPerWeekAvg,
    daysLoggedPct: Math.min(100, daysLoggedPct),
    weeksElapsed,
    totalLoggedDays: params.totalLoggedDays,
  }
}
