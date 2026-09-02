import type { ActivityLevel } from './types'

export type DailyMovement = 'sedentary' | 'moderately_active' | 'very_active'
export type TrainingFrequency = 'none' | 'light' | 'moderate' | 'frequent'
export type LiftingExperience = 'none' | 'beginner' | 'intermediate' | 'advanced'

const MOVEMENT_POINTS: Record<DailyMovement, number> = { sedentary: 0, moderately_active: 1, very_active: 2 }
const TRAINING_POINTS: Record<TrainingFrequency, number> = { none: 0, light: 1, moderate: 2, frequent: 3 }
const LIFTING_POINTS: Record<LiftingExperience, number> = { none: 0, beginner: 1, intermediate: 2, advanced: 3 }

/**
 * Maps the design's actual 3-question activity screen (frame 6: daily
 * movement by steps/day, training sessions/week, lifting experience) back
 * onto the existing 5-value `ActivityLevel` enum — a presentation-layer
 * change only, no change to `goalEngine`'s activity multipliers. Score
 * range is 0-8; boundaries chosen so the shape of the bucketing (most
 * combinations land moderate, the tails need real commitment on more than
 * one axis) matches the previous 3-question quiz's distribution.
 */
export function resolveActivityLevel(
  movement: DailyMovement,
  training: TrainingFrequency,
  lifting: LiftingExperience
): ActivityLevel {
  const score = MOVEMENT_POINTS[movement] + TRAINING_POINTS[training] + LIFTING_POINTS[lifting]

  if (score <= 1) return 'sedentary'
  if (score <= 3) return 'light'
  if (score <= 5) return 'moderate'
  if (score <= 7) return 'active'
  return 'very_active'
}

export const DAILY_MOVEMENT_OPTIONS: { value: DailyMovement; label: string; description: string }[] = [
  { value: 'sedentary', label: 'Sedentary', description: '< 5k steps' },
  { value: 'moderately_active', label: 'Moderately active', description: '5-9k steps' },
  { value: 'very_active', label: 'Very active', description: '10k+ steps' },
]

export const TRAINING_FREQUENCY_OPTIONS: { value: TrainingFrequency; label: string }[] = [
  { value: 'none', label: '0' },
  { value: 'light', label: '1-2' },
  { value: 'moderate', label: '3-5' },
  { value: 'frequent', label: '6+' },
]

export const LIFTING_EXPERIENCE_OPTIONS: { value: LiftingExperience; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]
