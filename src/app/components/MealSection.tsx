import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LogEntry, Meal, MealTemplate } from '../../data/models'
import { FoodRepo } from '../../data/repos/FoodRepo'
import { LogRepo } from '../../data/repos/LogRepo'
import { buildCopiedEntries } from '../../domain/logging/copyEntries'
import { formatPortion } from '../../domain/logging/formatPortion'
import { computeMacrosForGrams } from '../../domain/logging/portionMath'
import { computeMealSuggestions, type SuggestionChip } from '../../domain/logging/suggestions'
import { applyTemplate } from '../../domain/templates/applyTemplate'
import { addDaysISO, todayISO } from '../../lib/date'
import { vibrateTiny } from '../../lib/haptics'
import { useCountUp } from '../hooks/useCountUp'
import { useUIState } from '../shell/UIStateContext'
import MealOverflowSheet from './MealOverflowSheet'
import Snackbar from './Snackbar'
import SwipeToDeleteRow from './SwipeToDeleteRow'

interface Props {
  meal: Meal
  label: string
  entries: LogEntry[]
  onDelete: (id: number) => void
  /** ISO date this section belongs to. Omit for "today" (the Today dashboard's default). */
  date?: string
  /** Trailing ~14-day window of entries across all meals, used to derive empty-state suggestion chips. */
  historyEntries: LogEntry[]
}

const EMPTY_COPY: Record<Meal, string> = {
  breakfast: 'Nothing for breakfast yet.',
  lunch: 'Nothing for lunch yet.',
  snacks: 'Nothing for snacks yet.',
  dinner: 'Nothing for dinner yet.',
}

const UNDO_MS = 5000

export default function MealSection({
  meal,
  label,
  entries,
  onDelete,
  date,
  historyEntries,
}: Props) {
  const navigate = useNavigate()
  const prefersReducedMotion = useReducedMotion()
  const { openAddFoodSheet, notifyDataChanged } = useUIState()
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [snackbar, setSnackbar] = useState<{ message: string; onUndo?: () => void } | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const effectiveDate = date ?? todayISO()
  const subtotalKcal = useCountUp(Math.round(entries.reduce((sum, e) => sum + e.kcal, 0)), 300)

  const suggestions = useMemo(
    () => (entries.length === 0 ? computeMealSuggestions(historyEntries, meal, effectiveDate) : []),
    [entries.length, historyEntries, meal, effectiveDate]
  )

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
    if (date) {
      navigate(`/log/add?meal=${meal}&date=${date}`)
    } else {
      openAddFoodSheet(meal)
    }
  }

  function handleSaveTemplate() {
    setOverflowOpen(false)
    const dateSuffix = date ? `&date=${date}` : ''
    navigate(`/templates/new?meal=${meal}${dateSuffix}`)
  }

  async function handleLogTemplate(template: MealTemplate) {
    setOverflowOpen(false)
    const foods = await new FoodRepo().getByIds(template.entries.map((e) => e.foodId))
    const foodsById = new Map(foods.map((f) => [f.id, f]))
    const resolved = applyTemplate(template.entries, foodsById)
    const logRepo = new LogRepo()
    for (const entry of resolved) {
      await logRepo.addEntry({ date: effectiveDate, meal, ...entry })
    }
    vibrateTiny()
    notifyDataChanged()
  }

  async function handleCopyFromYesterday() {
    setOverflowOpen(false)
    const sourceDate = addDaysISO(effectiveDate, -1)
    const sourceEntries = (await new LogRepo().getEntriesForDate(sourceDate)).filter(
      (e) => e.meal === meal
    )
    if (sourceEntries.length === 0) {
      showSnackbar('Nothing to copy from yesterday.')
      return
    }
    const copies = buildCopiedEntries(sourceEntries, effectiveDate)
    const logRepo = new LogRepo()
    for (const copy of copies) {
      await logRepo.addEntry(copy)
    }
    vibrateTiny()
    notifyDataChanged()
    showSnackbar(`Copied ${copies.length} item${copies.length === 1 ? '' : 's'} from yesterday.`)
  }

  async function handleSuggestionTap(chip: SuggestionChip) {
    const foods = await new FoodRepo().getByIds(chip.entries.map((e) => e.foodId))
    const foodsById = new Map(foods.map((f) => [f.id, f]))
    const logRepo = new LogRepo()
    for (const entry of chip.entries) {
      const food = foodsById.get(entry.foodId)
      if (!food) continue
      const macros = computeMacrosForGrams(food.per100g, entry.grams)
      await logRepo.addEntry({
        date: effectiveDate,
        meal,
        foodId: entry.foodId,
        name: food.name,
        portionSummary: formatPortion({
          qty: entry.qty,
          unit: entry.unit,
          grams: entry.grams,
          portionLabel: entry.portionLabel,
        }),
        portionLabel: entry.portionLabel,
        qty: entry.qty,
        unit: entry.unit,
        grams: entry.grams,
        ...macros,
      })
    }
    vibrateTiny()
    notifyDataChanged()
  }

  return (
    <section className="mt-6" data-testid={`meal-section-${meal}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">{label}</h2>
        <div className="flex items-center gap-1">
          <span
            className="text-caption tabular-nums text-slate-500 dark:text-slate-400"
            data-testid={`meal-subtotal-${meal}`}
          >
            {subtotalKcal} kcal
          </span>
          <button
            type="button"
            onClick={() => setOverflowOpen(true)}
            aria-label={`${label} options`}
            data-testid={`meal-overflow-${meal}`}
            className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <span aria-hidden="true">⋯</span>
          </button>
        </div>
      </div>

      <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-lg bg-white shadow-sm dark:divide-slate-700 dark:bg-surface-dark-card">
        {entries.length === 0 &&
          (suggestions.length > 0 ? (
            <div className="flex flex-col gap-2 px-3 py-3">
              <p className="text-caption text-slate-500 dark:text-slate-400">Your usual?</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => handleSuggestionTap(chip)}
                    data-testid={`suggestion-chip-${meal}`}
                    className="min-h-touch rounded-full border border-brand-700 px-3 py-1 text-caption text-brand-700 dark:border-brand-400 dark:text-brand-400"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="px-3 py-3 text-caption text-slate-500 dark:text-slate-400">
              {EMPTY_COPY[meal]}
            </p>
          ))}

        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              layout={!prefersReducedMotion}
              initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            >
              <SwipeToDeleteRow onDelete={() => handleSwipeDelete(entry)} deleteLabel="Delete">
                <button
                  type="button"
                  onClick={() => handleRowTap(entry)}
                  aria-label={`Edit ${entry.name}`}
                  data-testid={`entry-row-${entry.id}`}
                  className="flex min-h-touch w-full items-center justify-between gap-2 px-3 py-2 text-left dark:bg-surface-dark-card"
                >
                  <div className="min-w-0">
                    <p className="truncate text-body font-medium text-slate-800 dark:text-slate-100">
                      {entry.name}
                    </p>
                    <p className="text-caption text-slate-500 dark:text-slate-400">
                      {formatPortion({
                        qty: entry.qty,
                        unit: entry.unit,
                        grams: entry.grams,
                        portionLabel: entry.portionLabel,
                        isCustom: !!entry.customSnapshot,
                      })}
                      {' · '}
                      {Math.round(entry.kcal)} kcal
                    </p>
                  </div>
                </button>
              </SwipeToDeleteRow>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        data-testid={`add-${meal}`}
        className="mt-2 min-h-touch rounded-lg px-2 text-caption font-medium text-brand-700 dark:text-brand-400"
      >
        + Add
      </button>

      <MealOverflowSheet
        open={overflowOpen}
        onClose={() => setOverflowOpen(false)}
        mealLabel={label}
        hasEntries={entries.length > 0}
        onSaveTemplate={handleSaveTemplate}
        onLogTemplate={handleLogTemplate}
        onCopyFromYesterday={handleCopyFromYesterday}
      />

      <Snackbar
        message={snackbar?.message ?? null}
        actionLabel={snackbar?.onUndo ? 'Undo' : undefined}
        onAction={snackbar?.onUndo}
      />
    </section>
  )
}
