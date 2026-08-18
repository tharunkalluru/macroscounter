import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { LogEntry, Meal, Targets } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { findApplicableTarget } from '../domain/history/targetForDate'
import { sumMacros } from '../domain/logging/portionMath'
import { isFutureDate } from '../lib/date'
import MacroBar from './components/MacroBar'
import MealSection from './components/MealSection'

const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snacks', label: 'Snacks' },
  { key: 'dinner', label: 'Dinner' },
]

export default function DayDetailPage() {
  const { date } = useParams<{ date: string }>()
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [target, setTarget] = useState<Targets | null>(null)
  const [loading, setLoading] = useState(true)

  const logRepo = new LogRepo()

  const load = useCallback(async () => {
    if (!date) return
    const [dayEntries, allTargets] = await Promise.all([
      logRepo.getEntriesForDate(date),
      new TargetRepo().getAll(),
    ])
    setEntries(dayEntries)
    setTarget(findApplicableTarget(date, allTargets) ?? null)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete(id: number) {
    await logRepo.deleteEntry(id)
    await load()
  }

  if (!date) return null

  if (isFutureDate(date)) {
    return (
      <div className="mx-auto max-w-md px-6 py-8">
        <Link to="/history" className="mb-4 inline-block text-sm text-brand-600 underline">
          ← Back
        </Link>
        <p className="text-slate-500">You can't log or view future days.</p>
      </div>
    )
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>
  }

  const totals = sumMacros(entries)
  const dayTarget = target ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }

  return (
    <div className="mx-auto max-w-md px-6 py-8 pb-16">
      <Link to="/history" className="mb-4 inline-block text-sm text-brand-600 underline">
        ← Back to calendar
      </Link>
      <h1 className="text-xl font-bold text-brand-700">{date}</h1>
      <p className="mt-1 text-sm text-slate-500" data-testid="day-total-kcal">
        {Math.round(totals.kcal)} / {dayTarget.kcal} kcal
      </p>

      <div className="mt-4 flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <MacroBar label="Protein" consumed={totals.p} target={dayTarget.proteinG} colorClass="bg-brand-600" testId="day-protein-bar" />
        <MacroBar label="Carbs" consumed={totals.c} target={dayTarget.carbsG} colorClass="bg-amber-500" testId="day-carbs-bar" />
        <MacroBar label="Fat" consumed={totals.f} target={dayTarget.fatG} colorClass="bg-sky-500" testId="day-fat-bar" />
      </div>

      {MEALS.map(({ key, label }) => (
        <MealSection
          key={key}
          meal={key}
          label={label}
          entries={entries.filter((e) => e.meal === key)}
          onDelete={handleDelete}
          date={date}
        />
      ))}
    </div>
  )
}
