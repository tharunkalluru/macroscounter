import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WeighIn } from '../../data/models'
import { WeighInRepo } from '../../data/repos/WeighInRepo'
import { computeEMA } from '../../domain/history/ema'
import { isFutureDate, todayISO } from '../../lib/date'
import { vibrateTiny } from '../../lib/haptics'
import { neutral, semantic } from '../../theme/tokens'
import { useTheme } from '../shell/ThemeContext'
import { TEXT_INPUT_CLASS } from './formStyles'
import Snackbar from './Snackbar'
import { WeightSectionSkeleton } from './Skeleton'
import SwipeToDeleteRow from './SwipeToDeleteRow'

const UNDO_MS = 5000

export default function WeightSection() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const gridStroke = isDark ? neutral[700] : neutral[200]
  const tickColor = isDark ? neutral[400] : neutral[500]
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [date, setDate] = useState(todayISO())
  const [weightKg, setWeightKg] = useState('')
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
    setWeighIns(await repo.getAll())
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
    return series.map((p) => ({ ...p, label: p.date.slice(5) }))
  }, [weighIns])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const weightNum = Number(weightKg)
    if (!Number.isFinite(weightNum) || weightNum < 30 || weightNum > 300) {
      return setError('Weight must be between 30 and 300 kg.')
    }
    if (isFutureDate(date)) {
      return setError("You can't log a future weigh-in.")
    }

    await repo.add({ date, weightKg: weightNum })
    setWeightKg('')
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
        className="flex items-end gap-3 rounded-card bg-white dark:bg-surface-dark-card p-4 shadow-card"
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
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Weight (kg)</span>
          <input
            type="number"
            step="0.1"
            className={`w-24 ${TEXT_INPUT_CLASS}`}
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="min-h-touch rounded-card bg-brand-700 px-4 py-2.5 font-medium text-white transition-transform active:scale-[0.98]"
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
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: tickColor }} />
              <YAxis
                domain={['dataMin - 1', 'dataMax + 1']}
                tick={{ fontSize: 12, fill: tickColor }}
              />
              <Tooltip
                contentStyle={
                  isDark
                    ? {
                        backgroundColor: neutral[800],
                        borderColor: neutral[700],
                        color: neutral[100],
                      }
                    : undefined
                }
              />
              <Line
                type="monotone"
                dataKey="weightKg"
                stroke={neutral[400]}
                dot={{ r: 2 }}
                name="Weight"
              />
              <Line
                type="monotone"
                dataKey="ema"
                stroke={semantic.success[600]}
                strokeWidth={2}
                dot={false}
                name="7-day trend"
              />
            </LineChart>
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
                {w.date} · {w.weightKg} kg
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
