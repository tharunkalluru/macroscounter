/** Fires a tiny haptic pulse on successful log/undo actions. No-ops on devices/browsers without the Vibration API. */
export function vibrateTiny(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(10)
  }
}
