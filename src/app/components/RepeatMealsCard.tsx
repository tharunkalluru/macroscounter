import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { LogEntry, Meal } from '../../data/models'
import { computeMealSuggestions, type SuggestionChip } from '../../domain/logging/suggestions'
import { activeMealWindow } from '../../domain/mealPrompt/activeMealWindow'
import { logSuggestionChip } from '../../lib/logging/logSuggestionChip'
import { diaryPath, todayISO } from '../../lib/date'
import { vibrateTiny } from '../../lib/haptics'
import { ForkKnifeIcon } from '../shell/icons'
import MealSuggestionRow from './MealSuggestionRow'

const MEALS: { key: Meal; label: string }[] = [{ key: 'breakfast', label: 'Breakfast' }, { key: 'lunch', label: 'Lunch' }, { key: 'dinner', label: 'Dinner' }, { key: 'snacks', label: 'Snacks' }]

/** `entries` is the parent's trailing 14-day diary window; no extra fetch or persistence. */
export default function RepeatMealsCard({ date, entries, onLogged }: { date: string; entries: LogEntry[]; onLogged: () => void }) {
  const [meal, setMeal] = useState<Meal>(() => {
    const preferred = activeMealWindow(new Date()) ?? 'breakfast'
    const history = entries.filter((entry) => entry.date < date)
    if (history.some((entry) => entry.meal === preferred)) return preferred
    return history.sort((a, b) => b.date.localeCompare(a.date))[0]?.meal ?? preferred
  })
  const [pending, setPending] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const saving = useRef(false)
  const suggestions = useMemo(() => computeMealSuggestions(entries, meal, date, 14, 2), [date, entries, meal])
  if (!entries.some((entry) => entry.date < date)) return null
  const dateLabel = date === todayISO() ? 'today' : new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

  async function log(chip: SuggestionChip) {
    if (saving.current) return
    saving.current = true
    setPending(chip.key)
    setError(null)
    setMessage(null)
    try {
      await logSuggestionChip(chip, meal, date)
      vibrateTiny()
      setMessage(`Added to ${meal} for ${dateLabel}.`)
      onLogged()
    } catch {
      setError('Could not repeat this meal. Nothing was added; please try again.')
    } finally {
      saving.current = false
      setPending(null)
    }
  }

  return (
    <section className="rounded-card bg-white p-5 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark" data-testid="repeat-meals-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Recent meals</h2>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"><ForkKnifeIcon /></span>
      </div>
      <div className="mb-3 mt-4 flex items-center justify-between gap-2">
        <label htmlFor="repeat-destination" className="text-caption text-slate-500 dark:text-slate-400">Add to {dateLabel}</label>
        <select id="repeat-destination" value={meal} disabled={pending !== null} onChange={(event) => { setMeal(event.target.value as Meal); setMessage(null); setError(null) }} className="min-h-touch max-w-[60%] rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-surface-dark-card">
          {MEALS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {suggestions.map((chip) => <MealSuggestionRow key={chip.key} chip={chip} onAdd={() => log(chip)} disabled={pending !== null} pending={pending === chip.key} addTestId="repeat-meal" />)}
      </div>
      {suggestions.length === 0 && <p className="py-2 text-sm text-slate-500 dark:text-slate-400">No recent {meal}. Try another meal.</p>}
      {message && <p role="status" className="mt-2 text-caption text-brand-700 dark:text-brand-400">{message} <Link className="underline" to={diaryPath(date)}>Review diary</Link></p>}
      {error && <p role="alert" className="mt-2 text-caption text-danger-700 dark:text-danger-300">{error}</p>}
      <Link to={`/log/usuals?date=${date}&meal=${meal}`} className="mt-2 inline-flex min-h-touch items-center text-caption font-medium text-brand-700 dark:text-brand-400">All recent meals <span className="ml-1" aria-hidden="true">→</span></Link>
    </section>
  )
}
