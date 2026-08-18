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

export function calculateBMR(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel]
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

  const absoluteFloor = sex === 'male' ? MALE_KCAL_FLOOR : FEMALE_KCAL_FLOOR
  const cutFloor = Math.max(bmr, absoluteFloor)

  let rawKcal: number
  if (goal === 'cut') {
    rawKcal = Math.max(tdee - CUT_DEFICIT_KCAL, cutFloor)
  } else if (goal === 'gain') {
    rawKcal = tdee + GAIN_SURPLUS_KCAL
  } else {
    rawKcal = tdee
  }
  const kcal = round(rawKcal)

  const proteinGPerKg = clamp(
    input.proteinGPerKg ?? DEFAULT_PROTEIN_G_PER_KG,
    MIN_PROTEIN_G_PER_KG,
    MAX_PROTEIN_G_PER_KG
  )
  const proteinG = round(proteinGPerKg * weightKg)

  const fatGPerKg = Math.max(input.fatGPerKg ?? MIN_FAT_G_PER_KG, MIN_FAT_G_PER_KG)
  const fatG = round(fatGPerKg * weightKg)

  const carbsKcal = kcal - proteinG * 4 - fatG * 9
  const carbsG = Math.max(0, round(carbsKcal / 4))

  return { kcal, proteinG, carbsG, fatG, bmr, tdee }
}
