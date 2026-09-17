import { addDaysISO } from '../../lib/date.js'
import type { Goal } from '../goals/types.js'

export interface DayKcal { date: string; kcal: number }
export interface WeighInPoint { date: string; weightKg: number }
export interface AdaptiveRecommendation {
  currentKcal: number
  suggestedKcal: number
  /** Actual floor-respecting change, not the unclamped proposal. */
  adjustment: number
  weeklyWeightChangeKg: number
  meanLoggedKcal: number
  impliedTDEE: number
  reason: string
  /** Attached by the repository layer; pure calculations have no persistence basis. */
  basis?: { fingerprint: string; referenceDate: string; proteinG: number; fatG: number }
}

const WINDOW_DAYS = 7
const KCAL_PER_KG = 7700
const MAX_WEEKLY_ADJUSTMENT = 100
const round1 = (value: number) => Math.round(value * 10) / 10
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

/**
 * An estimate from logged intake and weight change, never proof of complete
 * intake. Caller must ask the user to review missing meals before applying it.
 * Seven distinct dates with entries and weights at least three days apart are
 * required. Normalize by the actual weight interval, not the window length.
 */
export function computeAdaptiveAdjustment(params: {
  loggedDays: DayKcal[]
  weighIns: WeighInPoint[]
  currentTargetKcal: number
  floorKcal: number
  referenceDate: string
  goal?: Goal
  goalRateLbPerWeek?: number
}): AdaptiveRecommendation | null {
  const windowStart = addDaysISO(params.referenceDate, -(WINDOW_DAYS - 1))
  const days = new Map<string, number>()
  for (const day of params.loggedDays) {
    if (day.date >= windowStart && day.date <= params.referenceDate && Number.isFinite(day.kcal) && day.kcal >= 0) {
      days.set(day.date, day.kcal)
    }
  }
  if (days.size < WINDOW_DAYS) return null
  const weights = new Map<string, number>()
  for (const point of params.weighIns) {
    if (point.date >= windowStart && point.date <= params.referenceDate && Number.isFinite(point.weightKg) && point.weightKg > 0) {
      weights.set(point.date, point.weightKg)
    }
  }
  const points = [...weights].sort(([a], [b]) => a.localeCompare(b))
  if (points.length < 2) return null
  const first = points[0]
  const last = points[points.length - 1]
  const intervalDays = (Date.parse(`${last[0]}T00:00:00Z`) - Date.parse(`${first[0]}T00:00:00Z`)) / 86400000
  if (intervalDays < 3) return null
  const goal = params.goal ?? 'cut'
  const configuredRate = params.goalRateLbPerWeek
  const weeklyRateKg = Number.isFinite(configuredRate) && configuredRate! > 0
    ? configuredRate! / 2.2046226218
    : goal === 'gain' ? 0.25 : 0.5
  const desiredWeeklyChange = goal === 'maintain' ? 0 : goal === 'gain' ? weeklyRateKg : -weeklyRateKg
  const meanLoggedKcal = [...days.values()].reduce((sum, kcal) => sum + kcal, 0) / days.size
  const weeklyWeightChangeKg = (last[1] - first[1]) / intervalDays * WINDOW_DAYS
  const impliedTDEE = meanLoggedKcal - weeklyWeightChangeKg * KCAL_PER_KG / WINDOW_DAYS
  const idealTarget = impliedTDEE + desiredWeeklyChange * KCAL_PER_KG / WINDOW_DAYS
  const rawAdjustment = Math.round(clamp(idealTarget - params.currentTargetKcal, -MAX_WEEKLY_ADJUSTMENT, MAX_WEEKLY_ADJUSTMENT))
  const suggestedKcal = Math.max(Math.round(params.currentTargetKcal + rawAdjustment), params.floorKcal)
  const adjustment = suggestedKcal - params.currentTargetKcal
  const trend = Math.abs(weeklyWeightChangeKg) < 0.05 ? 'stayed about the same' : `${weeklyWeightChangeKg < 0 ? 'lost' : 'gained'} ${Math.abs(weeklyWeightChangeKg).toFixed(1)} kg per week at the observed rate`
  const goalDescription = goal === 'maintain' ? 'maintenance goal' : `${weeklyRateKg.toFixed(2)} kg/week ${goal === 'gain' ? 'gain' : 'loss'} goal`
  const action = adjustment === 0 ? 'no change needed' : `${adjustment > 0 ? 'raising' : 'lowering'} your target by ${Math.abs(adjustment)} kcal is a possible small adjustment`
  return {
    currentKcal: params.currentTargetKcal,
    suggestedKcal,
    adjustment,
    weeklyWeightChangeKg: round1(weeklyWeightChangeKg),
    meanLoggedKcal: round1(meanLoggedKcal),
    impliedTDEE: round1(impliedTDEE),
    reason: `Your weight ${trend}. For your ${goalDescription}, ${action}. This estimate uses logged intake; review missing meals before changing your target.`,
  }
}
