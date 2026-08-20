import type { ActivityLevel, Goal } from './types'

/** Canonical option lists for the profile form — shared by OnboardingFlow and SettingsPage so the two never drift out of sync. */
export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; description: string }[] = [
  { value: 'sedentary', label: 'Sedentary', description: 'Little to no exercise' },
  { value: 'light', label: 'Light', description: 'Exercise 1–3 days/week' },
  { value: 'moderate', label: 'Moderate', description: 'Exercise 3–5 days/week' },
  { value: 'active', label: 'Active', description: 'Exercise 6–7 days/week' },
  { value: 'very_active', label: 'Very active', description: 'Hard exercise daily' },
]

export const GOAL_OPTIONS: { value: Goal; label: string; description: string }[] = [
  { value: 'cut', label: 'Lose fat', description: 'Calorie deficit, higher protein' },
  { value: 'maintain', label: 'Maintain weight', description: 'Hold steady at maintenance' },
  { value: 'gain', label: 'Gain weight', description: 'Calorie surplus for muscle gain' },
]
