import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WeighIn } from '../../data/models'
import { ProfileRepo } from '../../data/repos/ProfileRepo'
import { WeighInRepo } from '../../data/repos/WeighInRepo'
import { computeEMA } from '../../domain/history/ema'
import { kgToLb } from '../../domain/units/weight'
import { isFutureDate, todayISO } from '../../lib/date'
import { vibrateTiny } from '../../lib/haptics'
import { neutral, semantic, surface, surfaceDark } from '../../theme/tokens'
import { useTheme } from '../shell/ThemeContext'
import { TEXT_INPUT_CLASS } from './formStyles'
import Snackbar from './Snackbar'
import { WeightSectionSkeleton } from './Skeleton'
import SwipeToDeleteRow from './SwipeToDeleteRow'
import WeightInput, { type WeightUnit } from './WeightInput'

const UNDO_MS = 5000
const MIN_KG = 30
const MAX_KG = 300

export default function WeightSection() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const gridStroke = isDark ? neutral[700] : neutral[200]
  const tickColor = isDark ? neutral[400] : neutral[500]
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [date, setDate] = useState(todayISO())
  const [weightKgInput, setWeightKgInput] = useState('')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [snackbar, setSnackbar] = useState<{ message: string; onUndo?: () => void } | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const repo = new WeighInRepo()

  function showSnackbar(message: string, onUndo?: () => void) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setSnackbar({ message, onUndo })
    undoTimerRef.current = setTimeout(() => setSnackbar(null), UNDO_MS)
  }

  async function load() {
    const [profile, allWeighIns] = await Promise.all([new ProfileRepo().get(), repo.getAll()])
    setWeightUnit(profile?.weightUnit ?? 'kg')
    setWeighIns(allWeighIns)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chartData = useMemo(() => {
    const series = computeEMA(
      weighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })),
      7
    )
    return series.map((p) => ({
      ...p,
      label: p.date.slice(5),
      weightKg: weightUnit === 'lb' ? kgToLb(p.weightKg) : p.weightKg,
      ema: weightUnit === 'lb' ? kgToLb(p.ema) : p.ema,
    }))
  }, [weighIns, weightUnit])

  function formatWeight(kg: number): string {
    return weightUnit === 'lb' ? `${kgToLb(kg)} lb` : `${kg} kg`
  }

  async function handleWeightUnitChange(unit: WeightUnit) {
    setWeightUnit(unit)
    const profileRepo = new ProfileRepo()
    const profile = await profileRepo.get()
    if (profile) await profileRepo.save({ ...profile, weightUnit: unit })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const weightNum = Number(weightKgInput)
    if (!Number.isFinite(weightNum) || weightNum < MIN_KG || weightNum > MAX_KG) {
      const bounds =
        weightUnit === 'lb' ? `${kgToLb(MIN_KG)} and ${kgToLb(MAX_KG)} lb` : `${MIN_KG} and ${MAX_KG} kg`
      return setError(`Weight must be between ${bounds}.`)
    }
    if (isFutureDate(date)) {
      return setError("You can't log a future weigh-in.")
    }

    await repo.add({ date, weightKg: weightNum })
    setWeightKgInput('')
    await load()
  }

  async function handleSwipeDelete(weighIn: WeighIn) {
    if (weighIn.id === undefined) return
    const { id: _id, ...snapshot } = weighIn
    await repo.delete(weighIn.id)
    await load()
    showSnackbar(`Deleted ${weighIn.date} weigh-in`, () => {
      vibrateTiny()
      repo.add(snapshot).then(() => load())
      setSnackbar(null)
    })
  }

  if (loading) {
    return <WeightSectionSkeleton />
  }

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-card bg-white dark:bg-surface-dark-card p-4 shadow-card"
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Date</span>
          <input
            type="date"
            max={todayISO()}
            className={TEXT_INPUT_CLASS}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <WeightInput
          valueKg={weightKgInput}
          onChangeKg={setWeightKgInput}
          unit={weightUnit}
          onUnitChange={handleWeightUnitChange}
        />
        <button
          type="submit"
          className="min-h-touch w-full rounded-card bg-brand-700 px-4 py-2.5 font-medium text-white transition-transform active:scale-[0.98]"
        >
          Log
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {chartData.length > 0 && (
        <div
          className="mt-6 h-56 rounded-card bg-white dark:bg-surface-dark-card p-4 shadow-card"
          data-testid="weight-chart"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="weightTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={semantic.success[500]} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={semantic.success[500]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: tickColor }} axisLine={{ stroke: gridStroke }} tickLine={false} />
              <YAxis
                domain={['dataMin - 1', 'dataMax + 1']}
                tick={{ fontSize: 12, fill: tickColor }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isDark ? surfaceDark.card : surface.card,
                  borderColor: isDark ? neutral[700] : neutral[200],
                  borderRadius: 12,
                  color: isDark ? neutral[100] : neutral[900],
                }}
                labelStyle={{ color: isDark ? neutral[300] : neutral[600] }}
              />
              <Area
                type="monotone"
                dataKey="ema"
                stroke="none"
                fill="url(#weightTrendFill)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="weightKg"
                stroke={neutral[400]}
                strokeWidth={1.5}
                dot={{ r: 2 }}
                name="Weight"
              />
              <Line
                type="monotone"
                dataKey="ema"
                stroke={semantic.success[600]}
                strokeWidth={2.5}
                dot={false}
                name="7-day trend"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <ul
        className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-card bg-white shadow-card dark:divide-slate-700 dark:bg-surface-dark-card"
        data-testid="weighin-list"
      >
        {[...weighIns].reverse().map((w) => (
          <li key={w.id}>
            <SwipeToDeleteRow onDelete={() => handleSwipeDelete(w)} deleteLabel="Delete">
              <div className="flex min-h-touch items-center px-3 py-2 text-sm">
                {w.date} · {formatWeight(w.weightKg)}
              </div>
            </SwipeToDeleteRow>
          </li>
        ))}
        {weighIns.length === 0 && (
          <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
            No weigh-ins yet.
          </li>
        )}
      </ul>

      <Snackbar
        message={snackbar?.message ?? null}
        actionLabel={snackbar?.onUndo ? 'Undo' : undefined}
        onAction={snackbar?.onUndo}
      />
    </div>
  )
}
