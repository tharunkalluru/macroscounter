import { motion } from 'framer-motion'
import { computeRingState } from '../../domain/ring/ringState'
import { isDarkFamily } from '../../domain/theme/resolveTheme'
import { getLargerNumbers } from '../../lib/settings/appearancePreferences'
import { motion as motionTokens, neutral, semantic } from '../../theme/tokens'
import { useCountUp } from '../hooks/useCountUp'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useTheme } from '../shell/ThemeContext'

interface Props {
  consumedKcal: number
  targetKcal: number
}

const RADIUS = 70
const STROKE = 12
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function CaloriesRing({ consumedKcal, targetKcal }: Props) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const largerNumbers = getLargerNumbers()
  const { resolvedTheme } = useTheme()
  const trackColor = isDarkFamily(resolvedTheme) ? neutral[800] : neutral[100]

  // Ring fill/color track the final (settled) values — framer-motion handles
  // their own smooth interpolation via the `animate` transition below.
  const finalState = computeRingState(consumedKcal, targetKcal)

  // The center number counts up from its previous value to the current one;
  // deriving its text from the *animated* eaten total (via the same
  // computeRingState formula) keeps the number, band, and sub-label all in
  // sync as it counts, rather than jumping straight to the final text.
  const eaten = useCountUp(Math.round(consumedKcal), motionTokens.countUpMs)
  const textState = computeRingState(eaten, targetKcal)

  const dashOffset = CIRCUMFERENCE * (1 - finalState.fillPct)
  // `semantic.over` exists precisely so the over-budget ring doesn't share
  // a color with the carbs macro / `semantic.warn` (see tokens.ts) — using
  // `warn` here recreated the exact ambiguity that token was built to fix.
  const ringColor = finalState.band === 'over' ? semantic.over[600] : semantic.success[600]

  const ariaLabel =
    targetKcal <= 0 ? `${Math.round(consumedKcal)} calories logged; no target for this day` : finalState.band === 'over'
      ? `${Math.round(consumedKcal)} of ${targetKcal} calories, ${finalState.centerText} over`
      : `${Math.round(consumedKcal)} calories eaten, ${Math.max(0, Math.round(targetKcal - consumedKcal))} remaining of ${targetKcal}`

  return (
    <div className="flex items-center justify-center gap-4">
      <div
        className="relative flex h-36 w-36 sm:h-40 sm:w-40 shrink-0 items-center justify-center"
        data-testid="calories-ring"
        role="img"
        aria-label={ariaLabel}
      >
        <svg className="h-full w-full" width={164} height={164} viewBox="0 0 180 180">
          <circle cx={90} cy={90} r={RADIUS} fill="none" stroke={trackColor} strokeWidth={STROKE} />
          <motion.circle
            cx={90}
            cy={90}
            r={RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={false}
            animate={{ strokeDashoffset: dashOffset }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: motionTokens.ringSweepMs / 1000, ease: [0.22, 1, 0.36, 1] }
            }
            transform="rotate(-90 90 90)"
          />
        </svg>
        <div className="absolute flex flex-col items-center" aria-hidden="true">
          <span
            className={`tabular-nums text-slate-900 dark:text-slate-100 ${largerNumbers ? 'text-display sm:text-4xl' : 'text-[28px] font-semibold sm:text-display'}`}
            data-testid="kcal-remaining"
          >
            {textState.centerText}
          </span>
          <span className="text-caption text-slate-500 dark:text-slate-400">
            {textState.subLabel}
          </span>
        </div>
      </div>

      <div
        className="grid min-w-0 gap-5 border-l border-slate-100 pl-4 dark:border-slate-800"
        data-testid="eaten-remaining-target"
      >
        <Figure label="Eaten" value={eaten} testId="figure-eaten" />
        <Figure label="Target" value={targetKcal > 0 ? targetKcal : null} testId="figure-target" />
      </div>
    </div>
  )
}

function Figure({ label, value, testId }: { label: string; value: number | null; testId: string }) {
  return (
    <div data-testid={testId}>
      <p className="text-lg font-semibold leading-tight tabular-nums text-slate-800 dark:text-slate-100">
        {value ?? '—'}
      </p>
      <p className="text-caption text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}
