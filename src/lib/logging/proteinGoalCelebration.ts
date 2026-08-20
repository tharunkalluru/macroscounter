const KEY_PREFIX = 'macrodesi:proteinGoalCelebrated:'

/**
 * Tracks whether today's "protein target hit" celebration has already shown
 * — purely local, ephemeral UI state (same localStorage approach as
 * mealPrompt/dismissal.ts), so no Dexie table/sync needed. Fires once per
 * day: crossing back below target (e.g. after a delete) and up again won't
 * re-trigger it.
 */
export function hasCelebratedProteinGoal(date: string): boolean {
  return localStorage.getItem(`${KEY_PREFIX}${date}`) === '1'
}

export function markProteinGoalCelebrated(date: string): void {
  localStorage.setItem(`${KEY_PREFIX}${date}`, '1')
}
