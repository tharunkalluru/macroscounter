import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, type ComponentType } from 'react'
import { TargetIcon } from '../shell/icons'

interface Props {
  show: boolean
  onDismiss: () => void
  message?: string
  icon?: ComponentType<{ className?: string }>
  /** Tailwind position-from-bottom class; lets a second concurrent toast avoid overlapping this one. */
  positionClassName?: string
}

const AUTO_DISMISS_MS = 3200

// Small on-brand confetti burst — reuses the same hues as the macro bars/ring
// rather than random colors, so it reads as "this app celebrating" instead
// of a generic effect. Skipped entirely under prefers-reduced-motion.
const CONFETTI = [
  { dx: -46, rotate: -30, className: 'bg-brand-500' },
  { dx: -26, rotate: 15, className: 'bg-protein-400' },
  { dx: -8, rotate: -10, className: 'bg-carbs-400' },
  { dx: 10, rotate: 25, className: 'bg-fat-400' },
  { dx: 28, rotate: -20, className: 'bg-brand-400' },
  { dx: 46, rotate: 10, className: 'bg-protein-500' },
]

export default function GoalCelebration({
  show,
  onDismiss,
  message = 'Protein goal hit - nice work.',
  icon: Icon = TargetIcon,
  positionClassName = 'bottom-24',
}: Props) {
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (!show) return
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
          className={`fixed inset-x-0 ${positionClassName} z-40 flex justify-center px-4`}
          data-testid="goal-celebration"
          role="status"
        >
          <div className="relative">
            {!prefersReducedMotion && (
              <div className="pointer-events-none absolute inset-x-0 -top-1 flex justify-center" aria-hidden="true">
                {CONFETTI.map((piece, i) => (
                  <motion.span
                    key={i}
                    className={`absolute h-2 w-2 rounded-sm ${piece.className}`}
                    initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
                    animate={{ opacity: 0, x: piece.dx, y: -34, rotate: piece.rotate }}
                    transition={{ duration: 0.7, delay: i * 0.02, ease: 'easeOut' }}
                  />
                ))}
              </div>
            )}
            <div className="flex items-center gap-2.5 rounded-full bg-brand-700 px-4 py-2.5 text-white shadow-card dark:bg-brand-600">
              <Icon className="shrink-0" />
              <span className="text-caption font-medium">{message}</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
