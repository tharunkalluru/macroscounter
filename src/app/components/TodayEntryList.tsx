import { AnimatePresence } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LogEntry, Meal } from '../../data/models'
import { LogRepo } from '../../data/repos/LogRepo'
import { activeMealWindow } from '../../domain/mealPrompt/activeMealWindow'
import { vibrateTiny } from '../../lib/haptics'
import { useUIState } from '../shell/UIStateContext'
import EntryRow from './EntryRow'
import Snackbar from './Snackbar'
import YourUsualsRow from './YourUsualsRow'

interface Props {
  entries: LogEntry[]
  historyEntries: LogEntry[]
  date: string
  isToday: boolean
  onDelete: (id: number) => void
  onLogged: () => void
}

const MEAL_ORDER: Meal[] = ['breakfast', 'lunch', 'snacks', 'dinner']
const UNDO_MS = 5000

/**
 * Today's logged items as one flat, chronological-by-meal list (Phase R.3)
 * — replaces the four per-meal `MealSection` blocks Dashboard used to
 * render directly. Meal grouping itself isn't gone, it moved to the Log
 * tab's Meals view (still `MealSection`, unchanged) for anyone who wants
 * the per-meal breakdown; Today now shows everything logged so far in one
 * place, matching the Nocturne redesign.
 */
export default function TodayEntryList({ entries, historyEntries, date, isToday, onDelete, onLogged }: Props) {
  const navigate = useNavigate()
  const { openAddFoodSheet, notifyDataChanged } = useUIState()
  const [snackbar, setSnackbar] = useState<{ message: string; onUndo?: () => void } | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => {
      const mealDiff = MEAL_ORDER.indexOf(a.meal) - MEAL_ORDER.indexOf(b.meal)
      return mealDiff !== 0 ? mealDiff : (a.id ?? 0) - (b.id ?? 0)
    })
  }, [entries])

  const activeMeal = isToday ? activeMealWindow(new Date()) : null
  const showUsuals = activeMeal !== null && entries.every((e) => e.meal !== activeMeal)

  function showSnackbar(message: string, onUndo?: () => void) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setSnackbar({ message, onUndo })
    undoTimerRef.current = setTimeout(() => setSnackbar(null), UNDO_MS)
  }

  function handleRowTap(entry: LogEntry) {
    if (entry.id === undefined) return
    navigate(entry.customSnapshot ? `/log/quick-add?entryId=${entry.id}` : `/log/edit/${entry.id}`)
  }

  function handleSwipeDelete(entry: LogEntry) {
    if (entry.id === undefined) return
    const { id: _id, ...snapshot } = entry
    onDelete(entry.id)
    showSnackbar(`Deleted ${entry.name}`, () => {
      vibrateTiny()
      new LogRepo().addEntry(snapshot).then(() => notifyDataChanged())
      setSnackbar(null)
    })
  }

  function handleAdd() {
    const meal = activeMeal ?? 'breakfast'
    if (isToday) {
      openAddFoodSheet(meal)
    } else {
      navigate(`/log/add?meal=${meal}&date=${date}`)
    }
  }

  return (
    <div className="mt-6" data-testid="today-entry-list">
      {showUsuals && activeMeal && (
        <YourUsualsRow meal={activeMeal} date={date} historyEntries={historyEntries} onLogged={onLogged} />
      )}

      <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg bg-white shadow-sm dark:divide-slate-700 dark:bg-surface-dark-card">
        {entries.length === 0 && (
          <p className="px-3 py-3 text-caption text-slate-500 dark:text-slate-400">Nothing logged yet today.</p>
        )}
        <AnimatePresence initial={false}>
          {sorted.map((entry) => (
            <EntryRow key={entry.id} entry={entry} onTap={handleRowTap} onSwipeDelete={handleSwipeDelete} />
          ))}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        data-testid="today-add-entry"
        className="mt-2 min-h-touch rounded-lg px-2 text-caption font-medium text-brand-700 dark:text-brand-400"
      >
        + Add
      </button>

      <Snackbar
        message={snackbar?.message ?? null}
        actionLabel={snackbar?.onUndo ? 'Undo' : undefined}
        onAction={snackbar?.onUndo}
      />
    </div>
  )
}
