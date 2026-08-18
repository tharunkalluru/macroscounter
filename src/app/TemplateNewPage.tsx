import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { LogEntry, Meal } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { MealTemplateRepo } from '../data/repos/MealTemplateRepo'
import { todayISO } from '../lib/date'

export default function TemplateNewPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const meal = (searchParams.get('meal') as Meal) || 'breakfast'
  const date = searchParams.get('date') || todayISO()

  const [entries, setEntries] = useState<LogEntry[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    new LogRepo()
      .getEntriesForDate(date)
      .then((all) => setEntries(all.filter((e) => e.meal === meal)))
      .finally(() => setLoading(false))
  }, [date, meal])

  const templatable = entries.filter((e) => e.foodId)
  const skipped = entries.length - templatable.length

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Please name this template.')
    if (templatable.length === 0) return setError('No foods in this meal can be saved as a template.')

    await new MealTemplateRepo().add({
      name: name.trim(),
      entries: templatable.map((entry) => ({
        foodId: entry.foodId!,
        qty: entry.qty,
        unit: entry.unit,
      })),
    })
    navigate('/templates')
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <Link to="/" className="mb-4 inline-block text-sm text-brand-600 underline">
        ← Back
      </Link>
      <h1 className="mb-1 text-xl font-bold text-brand-700">Save as template</h1>
      <p className="mb-4 text-sm text-slate-500">
        Saving {templatable.length} food{templatable.length === 1 ? '' : 's'} from this meal.
        {skipped > 0 && ` (${skipped} custom/recipe entr${skipped === 1 ? 'y' : 'ies'} skipped.)`}
      </p>

      <ul className="mb-4 divide-y divide-slate-100 rounded-lg bg-white shadow-sm">
        {templatable.map((entry) => (
          <li key={entry.id} className="px-3 py-2 text-sm">
            {entry.name} · {entry.portionSummary}
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Template name</span>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Usual Breakfast"
            autoFocus
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button type="submit" className="rounded bg-brand-600 px-4 py-2 font-medium text-white">
          Save template
        </button>
      </form>
    </div>
  )
}
