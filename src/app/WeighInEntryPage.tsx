import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { WeighInRepo } from '../data/repos/WeighInRepo'
import { computeEMA } from '../domain/history/ema'
import { kgToLb, lbToKg } from '../domain/units/weight'
import type { WeightUnit } from './components/WeightInput'
import { addDaysISO, isFutureDate, todayISO } from '../lib/date'
import { vibrateSuccess, vibrateTiny } from '../lib/haptics'
import { hasCelebratedGoalWeight, markGoalWeightCelebrated } from '../lib/goals/goalWeightCelebration'
import { projectGoalWeight } from '../domain/goals/weightProjection'
import GoalCelebration from './components/GoalCelebration'
import Sparkline from './components/Sparkline'
import { TargetIcon } from './shell/icons'

const MIN_KG = 30
const MAX_KG = 300
const TREND_DAYS = 14
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

/**
 * Full-screen weigh-in entry (frame 14) — a custom digit keypad, a big
 * hero numeral, and a 14-day trend context, replacing the plain inline
 * form as the primary way to log a weigh-in.
 */
export default function WeighInEntryPage() {
  const navigate = useNavigate()
  const [buffer, setBuffer] = useState('')
  const [unit, setUnit] = useState<WeightUnit>('kg')
  const [trend, setTrend] = useState<{ date: string; weightKg: number }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [profile, weighIns] = await Promise.all([
        new ProfileRepo().get(),
        new WeighInRepo().getInRange(addDaysISO(todayISO(), -(TREND_DAYS - 1)), todayISO()),
      ])
      if (profile?.weightUnit) setUnit(profile.weightUnit)
      setTrend(weighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })))
    })()
  }, [])

  const ema = useMemo(() => computeEMA(trend, 7), [trend])
  const trendDeltaKg = ema.length >= 2 ? ema[ema.length - 1].ema - ema[0].ema : null

  function press(key: string) {
    vibrateTiny()
    if (key === '⌫') {
      setBuffer((b) => b.slice(0, -1))
      return
    }
    if (key === '.' && buffer.includes('.')) return
    if (buffer.replace('.', '').length >= 5) return
    setBuffer((b) => b + key)
  }

  async function handleSave() {
    const entered = Number(buffer)
    if (!buffer || !Number.isFinite(entered) || entered <= 0) {
      setError('Enter a weight first.')
      return
    }
    const weightKg = unit === 'lb' ? lbToKg(entered) : entered
    if (weightKg < MIN_KG || weightKg > MAX_KG) {
      const bounds = unit === 'lb' ? `${kgToLb(MIN_KG)} and ${kgToLb(MAX_KG)} lb` : `${MIN_KG} and ${MAX_KG} kg`
      setError(`Weight must be between ${bounds}.`)
      return
    }
    const date = todayISO()
    if (isFutureDate(date)) return

    setSaving(true)
    try {
      const repo = new WeighInRepo()
      await repo.add({ date, weightKg })
      vibrateSuccess()
      await checkGoalReached(repo)
      navigate('/weight')
    } finally {
      setSaving(false)
    }
  }

  async function checkGoalReached(repo: WeighInRepo) {
    const profile = await new ProfileRepo().get()
    if (!profile?.goalWeightKg || hasCelebratedGoalWeight(profile.goalWeightKg)) return
    const allWeighIns = await repo.getAll()
    const projection = projectGoalWeight(
      allWeighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })),
      profile.goalWeightKg,
      todayISO()
    )
    if (projection.status !== 'at-goal') return
    markGoalWeightCelebrated(profile.goalWeightKg)
    setShowCelebration(true)
  }

  const displayValue = buffer || '0'
  const dateLabel = new Date(todayISO() + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-title text-slate-900 dark:text-slate-100">Weigh in</span>
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Close"
          data-testid="weighin-close"
          className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-slate-500 dark:text-slate-400"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <div className="mb-6 text-center">
          <span
            className="text-6xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-slate-100"
            data-testid="weighin-buffer"
          >
            {displayValue}
          </span>
          <p className="mt-2 text-caption uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {unit === 'lb' ? 'POUNDS' : 'KILOGRAMS'} · {dateLabel.toUpperCase()}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              data-testid={`weighin-key-${key === '⌫' ? 'backspace' : key}`}
              className="min-h-touch rounded-card border border-slate-200 py-4 text-xl font-medium text-slate-900 transition-transform active:scale-95 dark:border-slate-700 dark:text-slate-100"
            >
              {key}
            </button>
          ))}
        </div>

        {ema.length > 1 && (
          <div className="mt-6 rounded-card border border-slate-200 p-4 dark:border-slate-700">
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-caption uppercase tracking-widest text-brand-600 dark:text-brand-400">
                Trend, last {TREND_DAYS} days
              </span>
              {trendDeltaKg !== null && (
                <span className="text-sm font-semibold tabular-nums text-brand-700 dark:text-brand-400">
                  {trendDeltaKg <= 0 ? '' : '+'}
                  {unit === 'lb' ? kgToLb(trendDeltaKg) : Math.round(trendDeltaKg * 10) / 10} {unit}
                </span>
              )}
            </div>
            <Sparkline points={ema.map((p) => p.ema)} className="h-10 w-full" />
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-auto flex gap-3 pt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            data-testid="weighin-save"
            className="min-h-touch flex-1 rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save weigh-in'}
          </button>
        </div>
      </div>

      <GoalCelebration
        show={showCelebration}
        onDismiss={() => setShowCelebration(false)}
        message="You've reached your goal weight 🎉"
        icon={TargetIcon}
      />
    </div>
  )
}
