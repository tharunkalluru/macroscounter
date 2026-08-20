import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { motion as motionTokens } from '../../theme/tokens'

/** Fades/slides the shell's outlet content on tab-to-tab navigation. */
export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  const prefersReducedMotion = useReducedMotion()

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={location.pathname}
        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={{ duration: prefersReducedMotion ? 0 : motionTokens.screenTransitionMs / 1000 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
