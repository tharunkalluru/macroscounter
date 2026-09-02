import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { useCallback, useEffect, useState } from 'react'
import type { LogEntry, Meal } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { addDaysISO, todayISO } from '../lib/date'
import { getDefaultLogView } from '../lib/settings/logViewPreference'
import DateStrip from './components/DateStrip'
import { DragHandleIcon } from './shell/icons'
import MealSection from './components/MealSection'
import MonthView from './components/MonthView'
import TimelineView from './components/TimelineView'
import { useUIState } from './shell/UIStateContext'

const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snacks', label: 'Snacks' },
  { key: 'dinner', label: 'Dinner' },
]

type Tab = 'meals' | 'timeline' | 'month'
const TABS: { key: Tab; label: string }[] = [
  { key: 'meals', label: 'Meals' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'month', label: 'Month' },
]

/**
 * The Log tab — Meals is the per-meal breakdown; Timeline (Phase F.3) groups
 * the same day's entries by the hour they were actually logged, via
 * `LogEntry.loggedAt`; Month is the existing calendar. Meals/Timeline share
 * a date strip so either view can look at any of the last 7 days, not just
 * today.
 */
export default function LogPage() {
  const [tab, setTab] = useState<Tab>(getDefaultLogView)
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const { dataVersion } = useUIState()
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [historyEntries, setHistoryEntries] = useState<LogEntry[]>([])
  const [draggingEntry, setDraggingEntry] = useState<LogEntry | null>(null)
  const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const loadEntries = useCallback(async () => {
    const [dayEntries, historyRange] = await Promise.all([
      new LogRepo().getEntriesForDate(selectedDate),
      new LogRepo().getEntriesForDateRange(addDaysISO(selectedDate, -14), selectedDate),
    ])
    setEntries(dayEntries)
    setHistoryEntries(historyRange)
  }, [selectedDate])

  useEffect(() => {
    if (tab === 'month') return
    loadEntries()
  }, [tab, dataVersion, loadEntries])

  async function handleDelete(id: number) {
    await new LogRepo().deleteEntry(id)
    await loadEntries()
  }

  async function handleMoveEntry(id: number, meal: Meal) {
    await new LogRepo().updateEntry(id, { meal })
    await loadEntries()
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingEntry(entries.find((e) => e.id === event.active.id) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingEntry(null)
    const overMeal = event.over?.id as Meal | undefined
    if (!overMeal) return
    const entryId = Number(event.active.id)
    const entry = entries.find((e) => e.id === entryId)
    if (!entry || entry.meal === overMeal) return
    handleMoveEntry(entryId, overMeal)
  }

  const isToday = selectedDate === todayISO()

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

      {tab !== 'month' && (
        <div className="mt-3">
          <DateStrip selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>
      )}

      {tab === 'meals' && (
        <div className="mt-2" role="tabpanel">
          {!isToday && (
            <button
              type="button"
              onClick={() => setSelectedDate(todayISO())}
              data-testid="log-return-to-today"
              className="mb-3 min-h-touch rounded-full bg-brand-50 px-3 py-1.5 text-caption font-medium text-brand-700 dark:bg-slate-800 dark:text-brand-400"
            >
              Return to today
            </button>
          )}
          <DndContext sensors={dragSensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {MEALS.map(({ key, label }) => (
              <MealSection
                key={key}
                meal={key}
                label={label}
                entries={entries.filter((e) => e.meal === key)}
                onDelete={handleDelete}
                // MealSection's own "date" prop doubles as "am I viewing a
                // specific non-today day" (it decides sheet vs. full-page
                // add-food navigation on that truthiness) -- passing today's
                // own date here would wrongly force the full-page route even
                // while looking at today.
                date={isToday ? undefined : selectedDate}
                historyEntries={historyEntries}
              />
            ))}
            <DragOverlay>
              {draggingEntry && (
                <div
                  className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-card dark:bg-surface-dark-card"
                  data-testid="entry-drag-overlay"
                >
                  <DragHandleIcon className="text-slate-400 dark:text-slate-500" />
                  <span className="text-body font-medium text-slate-800 dark:text-slate-100">
                    {draggingEntry.name}
                  </span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="mt-4" role="tabpanel">
          <TimelineView entries={entries} onDelete={handleDelete} />
        </div>
      )}

      {tab === 'month' && (
        <div className="mt-4" role="tabpanel">
          <MonthView />
        </div>
      )}
    </div>
  )
}
