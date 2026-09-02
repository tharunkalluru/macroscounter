import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Meal } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { isFutureDate, todayISO } from '../lib/date'
import { vibrateTiny } from '../lib/haptics'
import PageHeader from './components/PageHeader'
import { TEXT_INPUT_CLASS } from './components/formStyles'

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
}

export default function QuickAddPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const entryIdParam = searchParams.get('entryId')
  const editingId = entryIdParam ? Number(entryIdParam) : null

  const [meal, setMeal] = useState<Meal>((searchParams.get('meal') as Meal) || 'breakfast')
  const requestedDate = searchParams.get('date')
  const [entryDate, setEntryDate] = useState(
    requestedDate && !isFutureDate(requestedDate) ? requestedDate : todayISO()
  )
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [p, setP] = useState('')
  const [c, setC] = useState('')
  const [f, setF] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editingId === null) return
    ;(async () => {
      const entry = await new LogRepo().getById(editingId)
      if (!entry) return
      // Entries with a customSnapshot (quick-add, AI logging) use its exact
      // saved values; everything else routed here has neither a foodId nor
      // a recipeId (e.g. a barcode-scanned entry -- AddFoodPage only knows
      // how to re-select those two kinds), so fall back to the entry's own
      // denormalized fields, which every LogEntry carries regardless of
      // source.
      const snapshot = entry.customSnapshot ?? { name: entry.name, kcal: entry.kcal, p: entry.p, c: entry.c, f: entry.f }
      setMeal(entry.meal)
      setEntryDate(entry.date)
      setName(snapshot.name)
      setKcal(String(snapshot.kcal))
      setP(String(snapshot.p))
      setC(String(snapshot.c))
      setF(String(snapshot.f))
    })()
  }, [editingId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const kcalNum = Number(kcal)
    const pNum = Number(p) || 0
    const cNum = Number(c) || 0
    const fNum = Number(f) || 0

    if (!name.trim()) return setError('Please enter a name.')
    if (!Number.isFinite(kcalNum) || kcalNum < 0) return setError('Calories must be 0 or more.')

    const entryData = {
      date: entryDate,
      meal,
      customSnapshot: { name: name.trim(), kcal: kcalNum, p: pNum, c: cNum, f: fNum },
      name: name.trim(),
      portionSummary: 'custom',
      qty: 1,
      unit: 'portion' as const,
      grams: 0,
      kcal: kcalNum,
      p: pNum,
      c: cNum,
      f: fNum,
    }

    const logRepo = new LogRepo()
    if (editingId !== null) {
      await logRepo.updateEntry(editingId, entryData)
    } else {
      await logRepo.addEntry(entryData)
    }
    vibrateTiny()
    navigate(backTo)
  }

  const backTo = entryDate === todayISO() ? '/' : `/history/${entryDate}`

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <PageHeader
        title={editingId !== null ? 'Edit custom entry' : `Custom add · ${MEAL_LABELS[meal]}`}
        backTo={backTo}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input
            className={TEXT_INPUT_CLASS}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Restaurant meal"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Calories (kcal)</span>
          <input
            type="number"
            className={TEXT_INPUT_CLASS}
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Protein (g)</span>
            <input
              type="number"
              className={TEXT_INPUT_CLASS}
              value={p}
              onChange={(e) => setP(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Carbs (g)</span>
            <input
              type="number"
              className={TEXT_INPUT_CLASS}
              value={c}
              onChange={(e) => setC(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Fat (g)</span>
            <input
              type="number"
              className={TEXT_INPUT_CLASS}
              value={f}
              onChange={(e) => setF(e.target.value)}
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="min-h-touch rounded-card bg-brand-700 px-4 py-2.5 font-medium text-white transition-transform active:scale-[0.98]"
        >
          {editingId !== null ? 'Save changes' : `Add to ${MEAL_LABELS[meal]}`}
        </button>
      </form>
    </div>
  )
}
