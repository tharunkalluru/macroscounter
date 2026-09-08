import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Meal } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { diaryDate, diaryPath } from '../lib/date'
import { vibrateTiny } from '../lib/haptics'
import { useUIState } from './shell/UIStateContext'
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
  const { notifyDataChanged } = useUIState()
  const entryIdParam = searchParams.get('entryId')
  const editingId = entryIdParam ? Number(entryIdParam) : null

  const [meal, setMeal] = useState<Meal>((searchParams.get('meal') as Meal) || 'breakfast')
  const requestedDate = searchParams.get('date')
  const [entryDate, setEntryDate] = useState(
    diaryDate(requestedDate)
  )
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [p, setP] = useState('')
  const [c, setC] = useState('')
  const [f, setF] = useState('')
  const [fiber, setFiber] = useState('')
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
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
      const snapshot =
        entry.customSnapshot ??
        { name: entry.name, kcal: entry.kcal, p: entry.p, c: entry.c, f: entry.f, fiber: entry.fiber }
      setMeal(entry.meal)
      setEntryDate(entry.date)
      setName(snapshot.name)
      setKcal(String(snapshot.kcal))
      setP(String(snapshot.p))
      setC(String(snapshot.c))
      setF(String(snapshot.f))
      setFiber(snapshot.fiber !== undefined ? String(snapshot.fiber) : '')
    })()
  }, [editingId])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (savingRef.current) return
    setError(null)

    const kcalNum = Number(kcal)
    const pNum = Number(p)
    const cNum = Number(c)
    const fNum = Number(f)
    const fiberNum = fiber.trim() ? Number(fiber) : undefined

    if (!name.trim()) return setError('Please enter a name.')
    if (!kcal.trim()) return setError('Please enter calories, even if the value is 0.')
    if ([pNum, cNum, fNum, fiberNum ?? 0].some((value) => !Number.isFinite(value) || value < 0 || value > 10000)) return setError('Nutrients must be between 0 and 10,000 grams.')
    if (!Number.isFinite(kcalNum) || kcalNum < 0 || kcalNum > 100000) return setError('Calories must be between 0 and 100,000.')

    const entryData = {
      date: entryDate,
      meal,
      customSnapshot: { name: name.trim(), kcal: kcalNum, p: pNum, c: cNum, f: fNum, fiber: fiberNum },
      name: name.trim(),
      portionSummary: 'custom',
      qty: 1,
      unit: 'portion' as const,
      grams: 0,
      kcal: kcalNum,
      p: pNum,
      c: cNum,
      f: fNum,
      fiber: fiberNum,
    }

    savingRef.current = true
    setSaving(true)
    try {
    const logRepo = new LogRepo()
    if (editingId !== null) {
      await logRepo.updateEntry(editingId, entryData)
    } else {
      await logRepo.addEntry(entryData)
    }
    vibrateTiny()
    notifyDataChanged()
    navigate(backTo)
    } catch {
      setError('Your entry could not be saved. Please try again.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const backTo = diaryPath(entryDate)

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <PageHeader
        title={editingId !== null ? 'Edit custom entry' : `Custom add · ${MEAL_LABELS[meal]}`}
        backTo={backTo}
      />

      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Logging for {entryDate}. Enter the nutrition for the whole portion.</p>
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
            min="0"
            step="any"
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
            min="0"
            step="any"
              className={TEXT_INPUT_CLASS}
              value={p}
              onChange={(e) => setP(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Carbs (g)</span>
            <input
              type="number"
            min="0"
            step="any"
              className={TEXT_INPUT_CLASS}
              value={c}
              onChange={(e) => setC(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Fat (g)</span>
            <input
              type="number"
            min="0"
            step="any"
              className={TEXT_INPUT_CLASS}
              value={f}
              onChange={(e) => setF(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Fiber (g)</span>
            <input
              type="number"
            min="0"
            step="any"
              className={TEXT_INPUT_CLASS}
              value={fiber}
              onChange={(e) => setFiber(e.target.value)}
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
          disabled={saving}
          className="min-h-touch rounded-card bg-brand-700 px-4 py-2.5 font-medium text-white transition-transform active:scale-[0.98]"
        >
          {saving ? 'Saving…' : editingId !== null ? 'Save changes' : `Add to ${MEAL_LABELS[meal]}`}
        </button>
      </form>
    </div>
  )
}
