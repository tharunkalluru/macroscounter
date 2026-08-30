const KEY_PREFIX = 'macrodesi:streakMilestoneCelebrated:'

/**
 * Tracks whether a given streak *run* has already celebrated a given
 * milestone — keyed by the run's start date (not the date it was hit), same
 * localStorage approach as proteinGoalCelebration.ts. Keying by run start
 * (rather than milestone number alone) lets the same milestone celebrate
 * again after a broken streak rebuilds, instead of firing only once ever.
 */
export function hasCelebratedStreakMilestone(streakStartDate: string, milestone: number): boolean {
  return localStorage.getItem(`${KEY_PREFIX}${streakStartDate}:${milestone}`) === '1'
}

export function markStreakMilestoneCelebrated(streakStartDate: string, milestone: number): void {
  localStorage.setItem(`${KEY_PREFIX}${streakStartDate}:${milestone}`, '1')
}
