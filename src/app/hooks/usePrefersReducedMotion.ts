import { useReducedMotion as useOSReducedMotion } from 'framer-motion'
import { getReduceMotionPreference } from '../../lib/settings/appearancePreferences'

/**
 * The OS `prefers-reduced-motion` setting OR the in-app "Reduce motion"
 * preference (Settings > Appearance) — either one turns animations off.
 * Drop-in replacement for framer-motion's own `useReducedMotion` at the
 * app's most visible animation sites (the calories ring, step-wizard
 * progress bars); not every animation in the app has been swept to use
 * this yet.
 */
export function usePrefersReducedMotion(): boolean {
  const osPreference = useOSReducedMotion()
  return osPreference || getReduceMotionPreference()
}
