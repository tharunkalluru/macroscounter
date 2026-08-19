import { motion, useReducedMotion } from 'framer-motion'
import { computeRingState } from '../../domain/ring/ringState'
import { motion as motionTokens, neutral, semantic } from '../../theme/tokens'
import { useCountUp } from '../hooks/useCountUp'

interface Props {
  consumedKcal: number
  targetKcal: number
}

const RADIUS = 70
const STROKE = 8
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function CaloriesRing({ consumedKcal, targetKcal }: Props) {
  const prefersReducedMotion = useReducedMotion()

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
  const ringColor = finalState.band === 'over' ? semantic.warn[600] : semantic.success[600]

  const ariaLabel =
    finalState.band === 'over'
      ? `${Math.round(consumedKcal)} of ${targetKcal} calories, ${finalState.centerText} over`
      : `${Math.round(consumedKcal)} of ${targetKcal} calories remaining`

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex h-[180px] w-[180px] items-center justify-center"
        data-testid="calories-ring"
        role="img"
        aria-label={ariaLabel}
      >
        <svg width={180} height={180} viewBox="0 0 180 180">
          <circle cx={90} cy={90} r={RADIUS} fill="none" stroke={neutral[200]} strokeWidth={STROKE} />
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
          <span className="text-display tabular-nums text-slate-900" data-testid="kcal-remaining">
            {textState.centerText}
          </span>
          <span className="text-caption text-slate-500">{textState.subLabel}</span>
        </div>
      </div>

      <div
        className="mt-4 flex w-full max-w-[220px] justify-between text-center"
        data-testid="eaten-remaining-target"
      >
        <Figure label="Eaten" value={eaten} testId="figure-eaten" />
        <Figure
          label="Remaining"
          value={Math.max(0, targetKcal - Math.round(consumedKcal))}
          testId="figure-remaining"
        />
        <Figure label="Target" value={targetKcal} testId="figure-target" />
      </div>
    </div>
  )
}

function Figure({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div data-testid={testId}>
      <p className="text-body font-semibold tabular-nums text-slate-800">{value}</p>
      <p className="text-caption text-slate-500">{label}</p>
    </div>
  )
}
