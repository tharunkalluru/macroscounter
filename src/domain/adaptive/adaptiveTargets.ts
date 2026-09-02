import { addDaysISO } from '../../lib/date.js'

export interface DayKcal {
  date: string
  kcal: number
}

export interface WeighInPoint {
  date: string
  weightKg: number
}

export interface AdaptiveRecommendation {
  currentKcal: number
  suggestedKcal: number
  /** Signed, already clamped to +-100 kcal and floor-respecting on the target itself. */
  adjustment: number
  weeklyWeightChangeKg: number
  meanLoggedKcal: number
  impliedTDEE: number
  reason: string
}

const WINDOW_DAYS = 7
const KCAL_PER_KG = 7700
const TARGET_WEEKLY_LOSS_KG = 0.5
const DAILY_DEFICIT_FOR_TARGET_RATE = (TARGET_WEEKLY_LOSS_KG * KCAL_PER_KG) / WINDOW_DAYS // 550
const MAX_WEEKLY_ADJUSTMENT = 100
const PLATEAU_EPSILON_KG = 0.05

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function describeTrend(weeklyWeightChangeKg: number): string {
  if (weeklyWeightChangeKg < -PLATEAU_EPSILON_KG) {
    return `lost ${Math.abs(weeklyWeightChangeKg).toFixed(1)} kg`
  }
  if (weeklyWeightChangeKg > PLATEAU_EPSILON_KG) {
    return `gained ${weeklyWeightChangeKg.toFixed(1)} kg`
  }
  return "stayed about the same"
}

function buildReason(weeklyWeightChangeKg: number, adjustment: number): string {
  const trend = describeTrend(weeklyWeightChangeKg)
  if (adjustment > 0) {
    return `You ${trend} over the last 7 days - faster than your 0.5 kg/week goal, so we're raising your target by ${adjustment} kcal to keep this sustainable.`
  }
  if (adjustment < 0) {
    return `You ${trend} over the last 7 days - slower than your 0.5 kg/week goal, so we're lowering your target by ${Math.abs(adjustment)} kcal.`
  }
  return `You ${trend} over the last 7 days - right on track for your 0.5 kg/week goal, no change needed.`
}

/**
 * Weekly adaptive-target job. Compares mean logged intake against a
 * weight-trend-implied TDEE (derived from the raw weigh-in delta across the
 * trailing 7-day window, times 7700 kcal/kg) and nudges the kcal target
 * toward a 0.5 kg/week loss rate, clamped to +-100 kcal and never below
 * `floorKcal` (the same floor `computeGoalTargets`/`computeKcalFloor` use).
 * Returns null ("no-op") when there isn't a full 7 days of logged data or
 * fewer than 2 weigh-ins inside that window to establish a trend.
 */
export function computeAdaptiveAdjustment(params: {
  loggedDays: DayKcal[]
  weighIns: WeighInPoint[]
  currentTargetKcal: number
  floorKcal: number
  referenceDate: string
}): AdaptiveRecommendation | null {
  const windowStart = addDaysISO(params.referenceDate, -(WINDOW_DAYS - 1))

  const daysInWindow = params.loggedDays.filter(
    (d) => d.date >= windowStart && d.date <= params.referenceDate
  )
  if (daysInWindow.length < WINDOW_DAYS) return null

  const weighInsInWindow = params.weighIns
    .filter((w) => w.date >= windowStart && w.date <= params.referenceDate)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (weighInsInWindow.length < 2) return null

  const meanLoggedKcal = daysInWindow.reduce((sum, d) => sum + d.kcal, 0) / daysInWindow.length
  const weeklyWeightChangeKg =
    weighInsInWindow[weighInsInWindow.length - 1].weightKg - weighInsInWindow[0].weightKg

  const impliedTDEE = meanLoggedKcal - (weeklyWeightChangeKg * KCAL_PER_KG) / WINDOW_DAYS
  const idealTarget = impliedTDEE - DAILY_DEFICIT_FOR_TARGET_RATE

  const rawAdjustment = idealTarget - params.currentTargetKcal
  const adjustment = Math.round(clamp(rawAdjustment, -MAX_WEEKLY_ADJUSTMENT, MAX_WEEKLY_ADJUSTMENT))

  const suggestedKcal = Math.max(Math.round(params.currentTargetKcal + adjustment), params.floorKcal)

  return {
    currentKcal: params.currentTargetKcal,
    suggestedKcal,
    adjustment,
    weeklyWeightChangeKg: round1(weeklyWeightChangeKg),
    meanLoggedKcal: round1(meanLoggedKcal),
    impliedTDEE: round1(impliedTDEE),
    reason: buildReason(weeklyWeightChangeKg, adjustment),
  }
}
