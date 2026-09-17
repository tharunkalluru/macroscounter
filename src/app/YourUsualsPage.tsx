import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { LogEntry, Meal } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { buildCopiedEntries } from '../domain/logging/copyEntries'
import { summarizeDayCopy } from '../domain/logging/dayCopy'
import { computeMealSuggestions, type SuggestionChip } from '../domain/logging/suggestions'
import { addDaysISO, diaryDate, diaryPath, todayISO } from '../lib/date'
import { vibrateTiny } from '../lib/haptics'
import { logSuggestionChip } from '../lib/logging/logSuggestionChip'
import PageHeader from './components/PageHeader'
import { useUIState } from './shell/UIStateContext'

const MEAL_FILTERS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
]

const USUALS_LIMIT = 8
const HISTORY_WINDOW_DAYS = 30

export default function YourUsualsPage() {
  const navigate = useNavigate()
  const { dataVersion, notifyDataChanged } = useUIState()
  const [searchParams] = useSearchParams()
  const date = diaryDate(searchParams.get('date'))
  const requestedMeal = searchParams.get('meal')
  const saving = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meal, setMeal] = useState<Meal>(() => MEAL_FILTERS.find((item) => item.key === requestedMeal)?.key ?? 'breakfast')
  const [history, setHistory] = useState<LogEntry[] | null>(null)
  const [logged, setLogged] = useState<string | null>(null)

  const yesterday = addDaysISO(date, -1)

  useEffect(() => {
    let cancelled = false
    new LogRepo().getEntriesForDateRange(addDaysISO(date, -HISTORY_WINDOW_DAYS), date).then((entries) => { if (!cancelled) setHistory(entries) }).catch(() => { if (!cancelled) setError('Could not load recent meals. Please reload.') })
    return () => { cancelled = true }
  }, [date, dataVersion])

  const suggestions = useMemo(
    () => (history ? computeMealSuggestions(history, meal, date, HISTORY_WINDOW_DAYS, USUALS_LIMIT) : []),
    [history, meal, date]
  )

  const yesterdayEntries = useMemo(() => (history ?? []).filter((e) => e.date === yesterday), [history, yesterday])
  const yesterdaySummary = summarizeDayCopy(yesterdayEntries)

  async function handleLog(chip: SuggestionChip) {
    if (saving.current) return
    saving.current = true
    setPending(true)
    setError(null)
    try {
      await logSuggestionChip(chip, meal, date)
      vibrateTiny()
      setLogged(chip.key)
      notifyDataChanged()
    } catch { setError('Could not add this meal. Nothing was added; please try again.') }
    finally { saving.current = false; setPending(false) }
  }

  async function handleCopyYesterday() {
    if (saving.current) return
    saving.current = true
    setPending(true)
    setError(null)
    try {
      const copies = buildCopiedEntries(yesterdayEntries, date).map(({ loggedAt: _loggedAt, ...entry }) => entry)
      await new LogRepo().addEntries(copies)
      vibrateTiny()
      notifyDataChanged()
      navigate(diaryPath(date))
    } catch { setError('Could not copy these meals. Nothing was added; please try again.') }
    finally { saving.current = false; setPending(false) }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-6">
      <PageHeader title="Your usuals" backTo={diaryPath(date)} />
      <p className="-mt-2 mb-2 text-sm text-slate-500 dark:text-slate-400">
        Repeat a meal with its original portions. Adding to {meal} for {date === todayISO() ? 'today' : date}.
      </p>

      {error && <p role="alert" className="mt-2 text-sm text-danger-700 dark:text-danger-300">{error}</p>}
      {logged && <p role="status" className="mt-2 text-sm text-brand-700 dark:text-brand-400">Meal added. You can edit it in your diary.</p>}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {MEAL_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => { setMeal(f.key); setLogged(null) }}
            disabled={pending}
            data-testid={`usuals-filter-${f.key}`}
            aria-pressed={meal === f.key}
            className={`min-h-touch flex-none rounded-full px-3 py-1.5 text-sm font-medium transition-transform active:scale-95 ${
              meal === f.key
                ? 'bg-brand-100 text-brand-700 dark:bg-slate-700 dark:text-brand-400'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-2" data-testid="usuals-list">
        {suggestions.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No recent {MEAL_FILTERS.find((f) => f.key === meal)?.label.toLowerCase()} meals yet. Log a meal and it will be ready to repeat on another day.
          </p>
        )}
        {suggestions.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => handleLog(chip)}
            disabled={pending}
            data-testid="usuals-item"
            className="flex min-h-touch items-center gap-3 rounded-card border border-slate-200 bg-white p-3.5 text-left transition-transform active:scale-[0.98] dark:border-slate-700 dark:bg-surface-dark-card"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900 dark:text-slate-100">{chip.label}</p>
              <p className="text-caption text-slate-500 dark:text-slate-400">{chip.entries.map((entry) => entry.snapshot?.portionSummary ?? `${entry.grams} g`).join(' · ')} · logged {chip.count}×</p>
            </div>
            <span className="flex-none rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-600 dark:text-brand-400 dark:ring-brand-400">
              {logged === chip.key ? 'Logged' : pending ? '…' : 'Log'}
            </span>
          </button>
        ))}

        {yesterdaySummary.count > 0 && (
          <div className="mt-2 rounded-card border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface-dark-card">
            <p className="mb-2 text-caption uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Copy a whole day
            </p>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
              The previous day has {yesterdaySummary.kcal} kcal across {yesterdaySummary.count} item
              {yesterdaySummary.count === 1 ? '' : 's'}. Bring it over?
            </p>
            <button
              type="button"
              onClick={handleCopyYesterday}
              disabled={pending}
              data-testid="usuals-copy-yesterday"
              className="min-h-touch w-full rounded-card border border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 dark:border-brand-400 dark:text-brand-400"
            >
              Copy yesterday
            </button>
          </div>
        )}

        <p className="mt-2 text-caption text-slate-400 dark:text-slate-400">
          Ranked by how often you log each meal, then how recently. Portions and nutrition stay as originally logged.
        </p>
      </div>
    </div>
  )
}
