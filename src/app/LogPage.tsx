import { useCallback, useEffect, useState } from 'react'
import type { LogEntry, Meal } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { addDaysISO, todayISO } from '../lib/date'
import MealSection from './components/MealSection'
import MonthView from './components/MonthView'
import { useUIState } from './shell/UIStateContext'

const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snacks', label: 'Snacks' },
  { key: 'dinner', label: 'Dinner' },
]

type Tab = 'meals' | 'month'
const TABS: { key: Tab; label: string }[] = [
  { key: 'meals', label: 'Meals' },
  { key: 'month', label: 'Month' },
]

/**
 * The Log tab (Phase R.3) — Meals is today's per-meal breakdown (the exact
 * `MealSection` UI Dashboard used to render directly, relocated now that
 * Today shows a flat list instead); Month is the existing calendar. A
 * Timeline (hour-by-hour) view is in the source design too but needs an
 * honest "when was this logged" timestamp the data model doesn't have yet
 * (LogEntry only has a day + a meal slot) — deferred rather than faked.
 */
export default function LogPage() {
  const [tab, setTab] = useState<Tab>('meals')
  const { dataVersion } = useUIState()
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [historyEntries, setHistoryEntries] = useState<LogEntry[]>([])

  const loadEntries = useCallback(async () => {
    const today = todayISO()
    const [dayEntries, historyRange] = await Promise.all([
      new LogRepo().getEntriesForDate(today),
      new LogRepo().getEntriesForDateRange(addDaysISO(today, -14), today),
    ])
    setEntries(dayEntries)
    setHistoryEntries(historyRange)
  }, [])

  useEffect(() => {
    if (tab !== 'meals') return
    loadEntries()
  }, [tab, dataVersion, loadEntries])

  async function handleDelete(id: number) {
    await new LogRepo().deleteEntry(id)
    await loadEntries()
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <h1 className="sr-only">Log</h1>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Log view">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            data-testid={`log-tab-${t.key}`}
            className={`min-h-touch flex-1 rounded-md text-sm font-medium transition-transform active:scale-[0.97] ${
              tab === t.key
                ? 'bg-white text-brand-700 shadow-sm dark:bg-surface-dark-card dark:text-brand-400'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'meals' ? (
        <div className="mt-2" role="tabpanel">
          {MEALS.map(({ key, label }) => (
            <MealSection
              key={key}
              meal={key}
              label={label}
              entries={entries.filter((e) => e.meal === key)}
              onDelete={handleDelete}
              historyEntries={historyEntries}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4" role="tabpanel">
          <MonthView />
        </div>
      )}
    </div>
  )
}
