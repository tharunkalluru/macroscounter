import { motion, useReducedMotion } from 'framer-motion'

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
  const prefersReducedMotion = useReducedMotion()
  const rawPct = target > 0 ? Math.min(1, consumed / target) : 0
  const scale = consumed > 0 ? Math.max(rawPct, MIN_VISIBLE_SCALE) : 0

  const content = (
    <>
      <div className="flex justify-between text-caption text-slate-500">
        <span>{label}</span>
        <span className="tabular-nums" data-testid={`${testId}-value`}>
          {Math.round(consumed)} / {Math.round(target)} g
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <motion.div
          className={`h-2 w-full origin-left rounded-full ${colorClass}`}
          initial={false}
          animate={{ scaleX: scale }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </>
  )

  if (!onTap) {
    return (
      <div data-testid={testId}>{content}</div>
    )
  }

  return (
    <button
      type="button"
      onClick={onTap}
      data-testid={testId}
      className="min-h-touch w-full rounded-lg text-left"
      aria-label={`${label}: ${Math.round(consumed)} of ${Math.round(target)} grams — view breakdown`}
    >
      {content}
    </button>
  )
}
