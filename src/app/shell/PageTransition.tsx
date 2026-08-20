import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { motion as motionTokens } from '../../theme/tokens'

/**
 * Fades/slides the shell's outlet content in on tab-to-tab navigation.
 * Enter-only by design (no AnimatePresence/exit animation): an exit
 * animation requires the outgoing node to stay mounted until Framer Motion
 * decides it's done, and under rapid navigation that bookkeeping could get
 * interrupted, leaving a duplicate, invisible-but-still-in-the-DOM copy of
 * the previous page behind (confirmed live via Playwright's strict-mode
 * element resolution catching two matches for the same testid after
 * back-to-back route changes). Keying on pathname still forces React to
 * unmount the old node synchronously on every route change; the incoming
 * node just animates its own opacity/position in, which cannot get stuck
 * since there is no exit state to track.
 *
 * The very first route this component ever renders (e.g. the Dashboard
 * appearing for the first time right after onboarding, since AppShell/this
 * component don't exist yet while on /welcome or /onboarding) skips the fade
 * entirely -- matching AnimatePresence's old `initial={false}` semantics.
 * Without this, that first paint is transiently at partial opacity, which
 * both looks like a flash of nothing and reads as a real WCAG contrast
 * failure to anything (axe-core, a screen reader) that inspects the DOM
 * before the animation settles.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  const prefersReducedMotion = useReducedMotion()
  const hasMountedRef = useRef(false)
  const skipEnterAnimation = !hasMountedRef.current

  useEffect(() => {
    hasMountedRef.current = true
  }, [])

  return (
    <motion.div
      key={location.pathname}
      initial={skipEnterAnimation || prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : motionTokens.screenTransitionMs / 1000 }}
    >
      {children}
    </motion.div>
  )
}
