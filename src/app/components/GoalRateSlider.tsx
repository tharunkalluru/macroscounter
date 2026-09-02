interface Props {
  /** 'cut' or 'gain' — direction changes the label text, not the mechanics. */
  direction: 'cut' | 'gain'
  valueLbPerWeek: number
  onChange: (value: number) => void
}

const MIN = 0.25
const MAX = 2
const STEP = 0.25

/** lb/week goal-rate slider — feeds goalEngine's goalRateLbPerWeek. */
export default function GoalRateSlider({ direction, valueLbPerWeek, onChange }: Props) {
  const verb = direction === 'cut' ? 'lose' : 'gain'
  const kcalPerDay = Math.round((valueLbPerWeek * 3500) / 7)

  return (
    <div className="flex flex-col gap-3">
      <div className="text-center">
        <p className="text-display tabular-nums text-brand-700 dark:text-brand-400" data-testid="goal-rate-value">
          {valueLbPerWeek.toFixed(2)} lb/week
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Aim to {verb} {valueLbPerWeek.toFixed(2)} lb a week - about {kcalPerDay} kcal/day{' '}
          {direction === 'cut' ? 'deficit' : 'surplus'}.
        </p>
      </div>
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={STEP}
        value={valueLbPerWeek}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`Goal rate, ${verb} per week`}
        data-testid="goal-rate-slider"
        className="h-2 min-h-touch w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-700"
      />
      <div className="flex justify-between text-caption text-slate-400 dark:text-slate-500">
        <span>Slower</span>
        <span>Faster</span>
      </div>
    </div>
  )
}
