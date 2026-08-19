import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

interface Props {
  message: string | null
  actionLabel?: string
  onAction?: () => void
}

export default function Snackbar({ message, actionLabel, onAction }: Props) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
          className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4"
          data-testid="snackbar"
          role="status"
        >
          <div className="flex items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-white shadow-card">
            <span className="text-caption">{message}</span>
            {actionLabel && onAction && (
              <button
                type="button"
                onClick={onAction}
                className="min-h-touch text-caption font-semibold text-brand-400"
                data-testid="snackbar-action"
              >
                {actionLabel}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
