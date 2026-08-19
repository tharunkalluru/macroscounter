import { neutral, semantic } from '../../theme/tokens'

interface Props {
  consumedKcal: number
  targetKcal: number
}

const RADIUS = 70
const STROKE = 14
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function CaloriesRing({ consumedKcal, targetKcal }: Props) {
  const remaining = targetKcal - consumedKcal
  const over = remaining < 0
  const pct = targetKcal > 0 ? Math.min(1, Math.max(0, consumedKcal / targetKcal)) : 0
  const dashOffset = CIRCUMFERENCE * (1 - pct)

  return (
    <div className="relative flex h-[180px] w-[180px] items-center justify-center" data-testid="calories-ring">
      <svg width={180} height={180} viewBox="0 0 180 180">
        <circle cx={90} cy={90} r={RADIUS} fill="none" stroke={neutral[200]} strokeWidth={STROKE} />
        <circle
          cx={90}
          cy={90}
          r={RADIUS}
          fill="none"
          stroke={over ? semantic.danger[600] : semantic.success[600]}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 90 90)"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-slate-900" data-testid="kcal-remaining">
          {Math.round(Math.abs(remaining))}
        </span>
        <span className="text-xs text-slate-500">{over ? 'kcal over' : 'kcal remaining'}</span>
      </div>
    </div>
  )
}
