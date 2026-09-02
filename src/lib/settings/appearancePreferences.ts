const LARGER_NUMBERS_KEY = 'macrodesi:largerNumbers'
const REDUCE_MOTION_KEY = 'macrodesi:reduceMotion'

/**
 * "Reading comfort" preferences (Settings > Appearance, frame 36) —
 * local-only, no sync, same storage pattern as the theme preference. Both
 * default to off, matching today's behavior for anyone who's never touched
 * them.
 */
export function getLargerNumbers(): boolean {
  return localStorage.getItem(LARGER_NUMBERS_KEY) === '1'
}

export function setLargerNumbers(enabled: boolean): void {
  localStorage.setItem(LARGER_NUMBERS_KEY, enabled ? '1' : '0')
}

export function getReduceMotionPreference(): boolean {
  return localStorage.getItem(REDUCE_MOTION_KEY) === '1'
}

export function setReduceMotionPreference(enabled: boolean): void {
  localStorage.setItem(REDUCE_MOTION_KEY, enabled ? '1' : '0')
}
