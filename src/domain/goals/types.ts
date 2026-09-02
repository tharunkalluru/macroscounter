export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Goal = 'cut' | 'maintain' | 'gain'

export interface GoalEngineInput {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goal: Goal
  /** g of protein per kg bodyweight. Defaults to 1.8, clamped to [1.6, 2.2]. */
  proteinGPerKg?: number
  /** g of fat per kg bodyweight. Defaults to 0.7 (the floor); never allowed below it. */
  fatGPerKg?: number
  /**
   * Desired rate of weight change, lb/week — drives the cut deficit or gain
   * surplus as `rate * 3500 / 7` kcal/day instead of the fixed 500/300
   * constants. Omitted = old fixed-constant behavior (back-compat for every
   * caller that predates the Phase R.2 goal-rate slider). Ignored for
   * 'maintain'.
   */
  goalRateLbPerWeek?: number
  /**
   * Extra kcal/day added on top of the safety floor (BMR, or the
   * sex-based absolute minimum, whichever is higher) — a user's "gentler
   * cut" preference. Can only raise the floor, never lower it below the
   * existing safety minimum. Defaults to 0 (today's behavior).
   */
  floorBufferKcal?: number
  /**
   * Explicit opt-in to a lower calorie floor than the sex-based safety
   * minimum (1500 male / 1200 female) — the design's "Low, medical
   * supervision recommended" option. Replaces that sex-based minimum in
   * `max(bmr, ...)`, so the result is never allowed below the person's own
   * BMR regardless of how low this value is. Omitted = existing
   * sex-based-minimum behavior; there's no default that lowers the floor
   * on its own.
   */
  floorKcalOverride?: number
}

export interface GoalEngineResult {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  bmr: number
  tdee: number
}
