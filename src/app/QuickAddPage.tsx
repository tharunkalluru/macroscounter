import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { Meal } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { todayISO } from '../lib/date'

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
  const [entryDate, setEntryDate] = useState(todayISO())
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
      if (!entry?.customSnapshot) return
      setMeal(entry.meal)
      setEntryDate(entry.date)
      setName(entry.customSnapshot.name)
      setKcal(String(entry.customSnapshot.kcal))
      setP(String(entry.customSnapshot.p))
      setC(String(entry.customSnapshot.c))
      setF(String(entry.customSnapshot.f))
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
    navigate('/')
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <Link to="/" className="mb-4 inline-block text-sm text-brand-600 underline">
        ← Back
      </Link>
      <h1 className="mb-4 text-xl font-bold text-brand-700">
        {editingId !== null ? 'Edit custom entry' : `Custom add · ${MEAL_LABELS[meal]}`}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Restaurant meal"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Calories (kcal)</span>
          <input
            type="number"
            className="rounded border border-slate-300 px-3 py-2"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Protein (g)</span>
            <input
              type="number"
              className="rounded border border-slate-300 px-3 py-2"
              value={p}
              onChange={(e) => setP(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Carbs (g)</span>
            <input
              type="number"
              className="rounded border border-slate-300 px-3 py-2"
              value={c}
              onChange={(e) => setC(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Fat (g)</span>
            <input
              type="number"
              className="rounded border border-slate-300 px-3 py-2"
              value={f}
              onChange={(e) => setF(e.target.value)}
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button type="submit" className="rounded bg-brand-600 px-4 py-2 font-medium text-white">
          {editingId !== null ? 'Save changes' : `Add to ${MEAL_LABELS[meal]}`}
        </button>
      </form>
    </div>
  )
}
