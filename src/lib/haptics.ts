/** Fires a tiny haptic pulse on successful log/undo actions. No-ops on devices/browsers without the Vibration API. */
export function vibrateTiny(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(10)
  }
}

/** A short double-pulse for rarer, celebratory moments (e.g. hitting today's protein target) — distinct from the routine single tap of `vibrateTiny`. */
export function vibrateSuccess(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([15, 50, 15])
  }
}
