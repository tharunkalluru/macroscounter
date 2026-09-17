import { AnimatePresence } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LogEntry, Meal } from '../../data/models'
import { LogRepo } from '../../data/repos/LogRepo'
import { activeMealWindow } from '../../domain/mealPrompt/activeMealWindow'
import { vibrateTiny } from '../../lib/haptics'
import { useUIState } from '../shell/UIStateContext'
import EntryRow from './EntryRow'
import FoodDiaryIllustration from './FoodDiaryIllustration'
import { PlusIcon } from '../shell/icons'
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

  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current) }, [])

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

  function handleSwipeDelete(entry: LogEntry) {
    if (entry.id === undefined) return
    const { id: _id, ...snapshot } = entry
    Promise.resolve(onDelete(entry.id)).then(() => {
    showSnackbar(`Deleted ${entry.name}`, () => {
      vibrateTiny()
      new LogRepo().addEntry(snapshot).then(() => notifyDataChanged())
      setSnackbar(null)
    })
    }).catch(() => showSnackbar('Could not delete this entry. Try again.'))
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
    <section className="rounded-card bg-white p-5 shadow-card dark:bg-surface-dark-card dark:shadow-card-dark" data-testid="today-entry-list">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{isToday ? "Today’s food" : "Food diary"}</h2><span className="text-caption text-slate-500 dark:text-slate-400">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span></div>
      {showUsuals && activeMeal && (
        <YourUsualsRow meal={activeMeal} date={date} historyEntries={historyEntries} onLogged={onLogged} />
      )}

      <div className="mt-2 divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
        {entries.length === 0 && (
          <div className="px-4 pb-4 pt-1 text-center"><FoodDiaryIllustration className="mx-auto mb-2 h-24 w-40" /><p className="text-sm font-medium">{isToday ? "Your first meal starts here." : "Nothing logged for this day."}</p><p className="mt-2 text-caption text-slate-500 dark:text-slate-400">{isToday ? "Search a favorite, scan a label, or add a meal in your own words." : "Forgot to log? You can still add or edit your meals."}</p></div>
        )}
        <AnimatePresence initial={false}>
          {sorted.map((entry) => (
            <EntryRow key={entry.id} entry={entry} onSwipeDelete={handleSwipeDelete} />
          ))}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        data-testid="today-add-entry"
        className="pressable mt-3 flex min-h-touch w-full items-center justify-center gap-2 rounded-xl bg-brand-50 px-3 text-sm font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400"
      >
        <PlusIcon className="h-4 w-4" /> Add food
      </button>

      <Snackbar
        message={snackbar?.message ?? null}
        actionLabel={snackbar?.onUndo ? 'Undo' : undefined}
        onAction={snackbar?.onUndo}
      />
    </section>
  )
}
