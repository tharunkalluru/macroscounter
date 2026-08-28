import type { WeightPoint } from '../history/ema'
import { computeEMA } from '../history/ema'
import { addDaysISO } from '../../lib/date'

export type WeightProjectionStatus =
  | 'insufficient-data'
  | 'at-goal'
  | 'plateaued'
  | 'wrong-direction'
  | 'on-track'

export interface WeightProjection {
  status: WeightProjectionStatus
  /** +ve = gaining, -ve = losing. Present for every status except 'insufficient-data' and 'at-goal'. */
  weeklyRateKg?: number
  daysRemaining?: number
  projectedDate?: string
}

const MIN_POINTS = 3
const MIN_SPAN_DAYS = 7
const AT_GOAL_TOLERANCE_KG = 0.3
const PLATEAU_WEEKLY_KG = 0.05
/** Beyond this, the trend is too slow to give a meaningful date -- reads the same as a plateau to the user. */
const MAX_PROJECTION_DAYS = 365 * 2

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / msPerDay)
}

/**
 * Projects when a user will reach `goalWeightKg` from their actual weigh-in
 * trend (7-day EMA slope over the full logged span), not a naive two-point
 * average -- one noisy weigh-in shouldn't swing the ETA by weeks. Requires
 * at least 3 weigh-ins spanning >=7 days before it will project anything.
 */
export function projectGoalWeight(
  weighIns: WeightPoint[],
  goalWeightKg: number,
  referenceDate: string
): WeightProjection {
  if (weighIns.length < MIN_POINTS) return { status: 'insufficient-data' }

  const series = computeEMA(weighIns, 7)
  const first = series[0]
  const last = series[series.length - 1]
  const spanDays = daysBetween(first.date, last.date)
  if (spanDays < MIN_SPAN_DAYS) return { status: 'insufficient-data' }

  const currentWeightKg = last.ema
  const diffToGoal = goalWeightKg - currentWeightKg
  if (Math.abs(diffToGoal) <= AT_GOAL_TOLERANCE_KG) return { status: 'at-goal' }

  const dailyRate = (last.ema - first.ema) / spanDays
  const weeklyRateKg = round2(dailyRate * 7)
  if (Math.abs(weeklyRateKg) < PLATEAU_WEEKLY_KG) return { status: 'plateaued', weeklyRateKg }

  const movingTowardGoal = Math.sign(dailyRate) === Math.sign(diffToGoal)
  if (!movingTowardGoal) return { status: 'wrong-direction', weeklyRateKg }

  const daysRemaining = Math.round(diffToGoal / dailyRate)
  if (daysRemaining > MAX_PROJECTION_DAYS) return { status: 'plateaued', weeklyRateKg }

  return {
    status: 'on-track',
    weeklyRateKg,
    daysRemaining,
    projectedDate: addDaysISO(referenceDate, daysRemaining),
  }
}
