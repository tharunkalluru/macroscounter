import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion'
import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  headerExtra?: ReactNode
}

const DISMISS_OFFSET_PX = 120
const DISMISS_VELOCITY = 500

export default function BottomSheet({ open, onClose, title, children, headerExtra }: Props) {
  const prefersReducedMotion = useReducedMotion()
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    // Focus the sheet so Escape/tab work immediately, without stealing focus
    // from whatever input the caller wants focused (e.g. a search box).
    const raf = requestAnimationFrame(() => {
      if (!sheetRef.current?.contains(document.activeElement)) {
        sheetRef.current?.focus()
      }
    })
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      cancelAnimationFrame(raf)
    }
  }, [open, onClose])

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > DISMISS_OFFSET_PX || info.velocity.y > DISMISS_VELOCITY) {
      onClose()
    }
  }

  const transition = prefersReducedMotion ? { duration: 0 } : { type: 'spring' as const, damping: 32, stiffness: 340 }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-slate-900/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            onClick={onClose}
            aria-hidden="true"
            data-testid="sheet-backdrop"
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bottom-sheet-title"
            tabIndex={-1}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-card bg-white shadow-card outline-none dark:bg-surface-dark-card dark:shadow-card-dark"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={transition}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            data-testid="bottom-sheet"
          >
            <div className="flex shrink-0 flex-col items-center pt-2">
              <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" aria-hidden="true" />
              <div className="mt-2 flex w-full items-center justify-between px-4 pb-2">
                <h2 id="bottom-sheet-title" className="text-title text-slate-900 dark:text-slate-100">
                  {title}
                </h2>
                <div className="flex items-center gap-2">
                  {headerExtra}
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path
                        d="M5 5l10 10M15 5L5 15"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
