import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

interface Props {
  label: string
  consumed: number
  target: number
  colorClass: string
  testId: string
  onTap?: () => void
}

// A raw percentage-based scaleX can shrink a nonzero-but-small value down to
// an invisible sliver (or a squished, floating-looking rounded cap — the
// "floating-dot bug"). Flooring the *scale* at this value keeps a small but
// clearly visible ~8px-ish fill on this app's mobile-width bars whenever
// there's genuinely something logged, without needing to measure the DOM.
const MIN_VISIBLE_SCALE = 0.025

export default function MacroBar({ label, consumed, target, colorClass, testId, onTap }: Props) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const isOver = target > 0 && consumed > target
  const rawPct = target > 0 ? Math.min(1, consumed / target) : 0
  const scale = consumed > 0 ? Math.max(rawPct, MIN_VISIBLE_SCALE) : 0
  // Over target: the bar always represents everything eaten (100% = consumed),
  // split into the portion that was within budget and the portion that
  // wasn't — rather than clamping at 100% and hiding the overage entirely.
  const withinPct = isOver ? (target / consumed) * 100 : 0
  const overPct = isOver ? ((consumed - target) / consumed) * 100 : 0
  const overAmount = isOver ? Math.round(consumed - target) : 0
  const remaining = target > 0 && !isOver ? Math.round(target - consumed) : 0

  const content = (
    <>
      <div
        className={`text-caption text-slate-500 dark:text-slate-400 ${onTap ? 'flex flex-col gap-1' : 'flex justify-between gap-2'}`}
      >
        <span className="font-medium text-slate-700 dark:text-slate-200">{label}</span>
        <span className="tabular-nums leading-relaxed" data-testid={`${testId}-value`}>
          {Math.round(consumed)}
          {target > 0 ? ` / ${Math.round(target)}` : ''} g{' '}
          {isOver ? (
            <span className={`${onTap ? 'block' : 'inline'} text-over-700 dark:text-over-400`}>
              {onTap ? '' : ' · '}+{overAmount}
            </span>
          ) : target > 0 ? (
            <span className={onTap ? 'block' : 'inline'} data-testid={`${testId}-remaining`}>
              {onTap ? '' : ' · '}
              {remaining} left
            </span>
          ) : null}
        </span>
      </div>
      <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        {isOver ? (
          <>
            <div className={`h-full ${colorClass}`} style={{ width: `${withinPct}%` }} />
            <div className="h-full bg-over-500" style={{ width: `${overPct}%` }} />
          </>
        ) : (
          <motion.div
            className={`h-1.5 w-full origin-left rounded-full ${colorClass}`}
            initial={false}
            animate={{ scaleX: scale }}
            transition={
              prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
            }
          />
        )}
      </div>
    </>
  )

  if (!onTap) {
    return <div data-testid={testId}>{content}</div>
  }

  return (
    <button
      type="button"
      onClick={onTap}
      data-testid={testId}
      className="pressable min-h-touch w-full rounded-xl bg-slate-50 p-3 text-left dark:bg-surface-dark-raised"
      aria-label={`${label}: ${Math.round(consumed)}${target > 0 ? ` of ${Math.round(target)}` : ''} grams${
        target > 0 && !isOver ? `, ${remaining} remaining` : ''
      } - view breakdown`}
    >
      {content}
    </button>
  )
}
