import type { ActivityLevel, GoalEngineInput, GoalEngineResult, Sex } from './types'

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

const MIN_PROTEIN_G_PER_KG = 1.6
const MAX_PROTEIN_G_PER_KG = 2.2
const DEFAULT_PROTEIN_G_PER_KG = 1.8
const MIN_FAT_G_PER_KG = 0.7
const CUT_DEFICIT_KCAL = 500
const GAIN_SURPLUS_KCAL = 300
const MALE_KCAL_FLOOR = 1500
const FEMALE_KCAL_FLOOR = 1200
const KCAL_PER_LB = 3500

export function calculateBMR(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel]
}

/**
 * Institute of Medicine (2005) Adequate Intake for total fiber — a flat
 * sex/age target, not scaled by the user's own kcal target: fiber should
 * stay high through a cut (it's what keeps a deficit satiating), so tying
 * it to a possibly-reduced calorie target would push exactly the wrong
 * direction for the people who benefit from fiber most.
 */
export function computeFiberTarget(sex: Sex, age: number): number {
  if (sex === 'male') return age > 50 ? 30 : 38
  return age > 50 ? 21 : 25
}

/** The same never-below-this-many-kcal floor `computeGoalTargets` uses for 'cut' — exported for Phase 7's adaptive job. */
export function computeKcalFloor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const bmr = calculateBMR(sex, weightKg, heightCm, age)
  const absoluteFloor = sex === 'male' ? MALE_KCAL_FLOOR : FEMALE_KCAL_FLOOR
  return Math.max(bmr, absoluteFloor)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Math.round with float-representation noise removed first (e.g. 0.7 * 85
 * is 59.49999999999999 in IEEE754, which would wrongly round down instead
 * of the mathematically-correct half-up 60).
 */
function round(value: number): number {
  return Math.round(Number(value.toFixed(6)))
}

export function computeGoalTargets(input: GoalEngineInput): GoalEngineResult {
  const { sex, age, heightCm, weightKg, activityLevel, goal } = input

  const bmr = calculateBMR(sex, weightKg, heightCm, age)
  const tdee = calculateTDEE(bmr, activityLevel)

  const absoluteFloor = input.floorKcalOverride ?? (sex === 'male' ? MALE_KCAL_FLOOR : FEMALE_KCAL_FLOOR)
  const cutFloor = Math.max(bmr, absoluteFloor) + Math.max(input.floorBufferKcal ?? 0, 0)

  const rateKcalPerDay =
    input.goalRateLbPerWeek !== undefined ? (input.goalRateLbPerWeek * KCAL_PER_LB) / 7 : undefined

  let rawKcal: number
  if (goal === 'cut') {
    rawKcal = Math.max(tdee - (rateKcalPerDay ?? CUT_DEFICIT_KCAL), cutFloor)
  } else if (goal === 'gain') {
    rawKcal = tdee + (rateKcalPerDay ?? GAIN_SURPLUS_KCAL)
  } else {
    rawKcal = tdee
  }
  const requestedKcal = round(rawKcal)

  const proteinGPerKg = clamp(
    input.proteinGPerKg ?? DEFAULT_PROTEIN_G_PER_KG,
    MIN_PROTEIN_G_PER_KG,
    MAX_PROTEIN_G_PER_KG
  )
  const proteinG = round(proteinGPerKg * weightKg)

  const fatGPerKg = Math.max(input.fatGPerKg ?? MIN_FAT_G_PER_KG, MIN_FAT_G_PER_KG)
  const requestedFatG = round(fatGPerKg * weightKg)
  const minimumFatG = round(MIN_FAT_G_PER_KG * weightKg)

  // The displayed energy and macros must describe the same plan. Optional
  // higher-fat preferences can exceed a lower energy target, and for some
  // accepted profiles even chosen protein + the existing fat floor cannot
  // fit. Keep those established minimums, raising energy only when required;
  // then fit the optional fat allocation into the remaining energy. This
  // changes neither ordinary profiles nor the underlying energy formula.
  const minimumMacroKcal = proteinG * 4 + minimumFatG * 9
  const kcal = Math.max(requestedKcal, minimumMacroKcal)
  const availableFatG = Math.floor((kcal - proteinG * 4) / 9)
  const fatG = Math.max(minimumFatG, Math.min(requestedFatG, availableFatG))

  const carbsKcal = kcal - proteinG * 4 - fatG * 9
  const carbsG = Math.max(0, round(carbsKcal / 4))

  const fiberG = computeFiberTarget(sex, age)

  const adjustments: NonNullable<GoalEngineResult['adjustments']> = {}
  if (kcal > requestedKcal) adjustments.caloriesRaisedFrom = requestedKcal
  if (fatG < requestedFatG) adjustments.fatReducedFrom = requestedFatG

  return {
    kcal, proteinG, carbsG, fatG, fiberG, bmr, tdee,
    ...(Object.keys(adjustments).length ? { adjustments } : {}),
  }
}
