import type { Meal } from '../../data/models'

const KEY_PREFIX = 'macrodesi:mealPromptDismissed:'

/**
 * "Not now" suppresses the prompt for that meal window for the rest of the
 * day — purely local, ephemeral UI state (same localStorage approach as
 * AdaptiveTargetPrompt's weekly dismissal), so no Dexie table/sync needed.
 */
export function isMealPromptDismissed(date: string, meal: Meal): boolean {
  return localStorage.getItem(`${KEY_PREFIX}${date}:${meal}`) === '1'
}

export function dismissMealPrompt(date: string, meal: Meal): void {
  localStorage.setItem(`${KEY_PREFIX}${date}:${meal}`, '1')
}
