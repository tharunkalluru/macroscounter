import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WeighIn } from '../data/models'
import { WeighInRepo } from '../data/repos/WeighInRepo'
import { computeEMA } from '../domain/history/ema'
import { isFutureDate, todayISO } from '../lib/date'

export default function WeightPage() {
  const [weighIns, setWeighIns] = useState<WeighIn[]>([])
  const [date, setDate] = useState(todayISO())
  const [weightKg, setWeightKg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const repo = new WeighInRepo()

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

  async function handleDelete(id?: number) {
    if (id === undefined) return
    await repo.delete(id)
    await load()
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <Link to="/" className="mb-4 inline-block text-sm text-brand-600 underline">
        ← Back
      </Link>
      <h1 className="mb-4 text-xl font-bold text-brand-700">Weight tracking</h1>

      <form onSubmit={handleSubmit} className="flex items-end gap-3 rounded-xl bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Date</span>
          <input
            type="date"
            max={todayISO()}
            className="rounded border border-slate-300 px-3 py-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Weight (kg)</span>
          <input
            type="number"
            step="0.1"
            className="w-24 rounded border border-slate-300 px-3 py-2"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </label>
        <button type="submit" className="rounded bg-brand-600 px-4 py-2 font-medium text-white">
          Log
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {chartData.length > 0 && (
        <div className="mt-6 h-56 rounded-xl bg-white p-4 shadow-sm" data-testid="weight-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="weightKg" stroke="#94a3b8" dot={{ r: 2 }} name="Weight" />
              <Line type="monotone" dataKey="ema" stroke="#16a34a" strokeWidth={2} dot={false} name="7-day trend" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <ul className="mt-6 divide-y divide-slate-100 rounded-lg bg-white shadow-sm" data-testid="weighin-list">
        {[...weighIns].reverse().map((w) => (
          <li key={w.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span>
              {w.date} · {w.weightKg} kg
            </span>
            <button type="button" className="text-red-600 underline" onClick={() => handleDelete(w.id)}>
              Delete
            </button>
          </li>
        ))}
        {weighIns.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">No weigh-ins yet.</li>}
      </ul>
    </div>
  )
}
