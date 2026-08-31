import type { ActivityLevel } from './types'

export type JobActivity = 'desk' | 'on_feet' | 'physical'
export type ExerciseFrequency = 'none' | 'light' | 'moderate' | 'frequent'
export type DailyMovement = 'low' | 'moderate' | 'high'

const JOB_POINTS: Record<JobActivity, number> = { desk: 0, on_feet: 1, physical: 2 }
const EXERCISE_POINTS: Record<ExerciseFrequency, number> = {
  none: 0,
  light: 1,
  moderate: 2,
  frequent: 3,
}
const MOVEMENT_POINTS: Record<DailyMovement, number> = { low: 0, moderate: 1, high: 2 }

/**
 * Maps the 3-question onboarding activity quiz (frames 8-10 of the Nocturne
 * redesign) back onto the existing 5-value `ActivityLevel` enum — a
 * presentation-layer change only, no change to `goalEngine`'s activity
 * multipliers. Score range is 0-7; boundaries chosen so a "typical"
 * single-question answer (e.g. today's Settings dropdown) lands on the same
 * bucket a reasonable 3-question breakdown of it would.
 */
export function resolveActivityLevel(
  job: JobActivity,
  exercise: ExerciseFrequency,
  movement: DailyMovement
): ActivityLevel {
  const score = JOB_POINTS[job] + EXERCISE_POINTS[exercise] + MOVEMENT_POINTS[movement]

  if (score <= 1) return 'sedentary'
  if (score <= 3) return 'light'
  if (score <= 5) return 'moderate'
  if (score === 6) return 'active'
  return 'very_active'
}

export const JOB_ACTIVITY_OPTIONS: { value: JobActivity; label: string; description: string }[] = [
  { value: 'desk', label: 'Mostly sitting', description: 'Desk job, driving, studying' },
  { value: 'on_feet', label: 'On my feet', description: 'Teaching, retail, light labor' },
  { value: 'physical', label: 'Physically demanding', description: 'Construction, warehouse, farming' },
]

export const EXERCISE_FREQUENCY_OPTIONS: {
  value: ExerciseFrequency
  label: string
  description: string
}[] = [
  { value: 'none', label: "I don't really exercise", description: '' },
  { value: 'light', label: '1-2 days a week', description: '' },
  { value: 'moderate', label: '3-4 days a week', description: '' },
  { value: 'frequent', label: '5+ days a week', description: '' },
]

export const DAILY_MOVEMENT_OPTIONS: { value: DailyMovement; label: string; description: string }[] = [
  { value: 'low', label: 'Low', description: 'Mostly sitting, few steps' },
  { value: 'moderate', label: 'Moderate', description: 'Regular walking, some standing' },
  { value: 'high', label: 'High', description: "On the go most of the day" },
]
