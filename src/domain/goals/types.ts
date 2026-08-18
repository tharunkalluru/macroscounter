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
}

export interface GoalEngineResult {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  bmr: number
  tdee: number
}
