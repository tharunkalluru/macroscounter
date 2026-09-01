const KEY_PREFIX = 'macrodesi:goalWeightCelebrated:'

/**
 * Tracks whether the "goal weight reached" celebration has already shown
 * for a given goal weight — keyed by the goal itself (same localStorage
 * approach as proteinGoalCelebration.ts) so changing the goal in Settings
 * naturally re-arms the celebration for the new target.
 */
export function hasCelebratedGoalWeight(goalWeightKg: number): boolean {
  return localStorage.getItem(`${KEY_PREFIX}${goalWeightKg}`) === '1'
}

export function markGoalWeightCelebrated(goalWeightKg: number): void {
  localStorage.setItem(`${KEY_PREFIX}${goalWeightKg}`, '1')
}
