import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LogEntry, Meal } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { buildCopiedEntries } from '../domain/logging/copyEntries'
import { summarizeDayCopy } from '../domain/logging/dayCopy'
import { computeMealSuggestions, type SuggestionChip } from '../domain/logging/suggestions'
import { addDaysISO, todayISO } from '../lib/date'
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
  const { notifyDataChanged } = useUIState()
  const [meal, setMeal] = useState<Meal>('breakfast')
  const [history, setHistory] = useState<LogEntry[] | null>(null)
  const [logged, setLogged] = useState<string | null>(null)

  const today = todayISO()
  const yesterday = addDaysISO(today, -1)

  useEffect(() => {
    new LogRepo().getEntriesForDateRange(addDaysISO(today, -HISTORY_WINDOW_DAYS), today).then(setHistory)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const suggestions = useMemo(
    () => (history ? computeMealSuggestions(history, meal, today, HISTORY_WINDOW_DAYS, USUALS_LIMIT) : []),
    [history, meal, today]
  )

  const yesterdayEntries = useMemo(() => (history ?? []).filter((e) => e.date === yesterday), [history, yesterday])
  const yesterdaySummary = summarizeDayCopy(yesterdayEntries)

  async function handleLog(chip: SuggestionChip) {
    await logSuggestionChip(chip, meal, today)
    vibrateTiny()
    setLogged(chip.key)
    notifyDataChanged()
  }

  async function handleCopyYesterday() {
    const copies = buildCopiedEntries(yesterdayEntries, today)
    const logRepo = new LogRepo()
    for (const copy of copies) await logRepo.addEntry(copy)
    vibrateTiny()
    notifyDataChanged()
    navigate('/')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
      <PageHeader title="Your usuals" backTo="/" />
      <p className="-mt-2 mb-2 text-sm text-slate-500 dark:text-slate-400">
        The fastest way to log. Tap once — no search, no serving picker, no confirmation.
      </p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {MEAL_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setMeal(f.key)}
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
            No repeated {MEAL_FILTERS.find((f) => f.key === meal)?.label.toLowerCase()} combos yet — log the same
            thing a couple of times and it'll show up here.
          </p>
        )}
        {suggestions.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => handleLog(chip)}
            data-testid="usuals-item"
            className="flex min-h-touch items-center gap-3 rounded-card border border-slate-200 bg-white p-3.5 text-left transition-transform active:scale-[0.98] dark:border-slate-700 dark:bg-surface-dark-card"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900 dark:text-slate-100">{chip.label}</p>
              <p className="text-caption text-slate-500 dark:text-slate-400">logged {chip.count}×</p>
            </div>
            <span className="flex-none rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-600 dark:text-brand-400 dark:ring-brand-400">
              {logged === chip.key ? 'Logged' : 'Log'}
            </span>
          </button>
        ))}

        {yesterdaySummary.count > 0 && (
          <div className="mt-2 rounded-card border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-surface-dark-card">
            <p className="mb-2 text-caption uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Copy a whole day
            </p>
            <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
              Yesterday was {yesterdaySummary.kcal} kcal across {yesterdaySummary.count} item
              {yesterdaySummary.count === 1 ? '' : 's'}. Bring it over?
            </p>
            <button
              type="button"
              onClick={handleCopyYesterday}
              data-testid="usuals-copy-yesterday"
              className="min-h-touch w-full rounded-card border border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 dark:border-brand-400 dark:text-brand-400"
            >
              Copy yesterday
            </button>
          </div>
        )}

        <p className="mt-2 text-caption text-slate-400 dark:text-slate-400">
          Ranked by how often you log each combo at this time of day.
        </p>
      </div>
    </div>
  )
}
