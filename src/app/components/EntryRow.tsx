import { useDraggable } from '@dnd-kit/core'
import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LogEntry } from '../../data/models'
import { formatPortion } from '../../domain/logging/formatPortion'
import EntryDetailSheet from './EntryDetailSheet'
import FoodGlyph from './FoodGlyph'
import SwipeToDeleteRow from './SwipeToDeleteRow'
import { DragHandleIcon } from '../shell/icons'

interface Props {
  entry: LogEntry
  onSwipeDelete: (entry: LogEntry) => void
  /** Only true inside the Log tab's Meals view (MealSection), which has meal-section drop zones to move into. */
  draggable?: boolean
}

/** One log-entry row — tap to see its macro breakdown (with an Edit option inside), swipe left to delete, drag the handle to move it to another meal. Shared by MealSection and Today's flat entry list (Phase R.3) so both stay pixel-identical. */
export default function EntryRow({ entry, onSwipeDelete, draggable = false }: Props) {
  const prefersReducedMotion = useReducedMotion()
  const navigate = useNavigate()
  const [detailOpen, setDetailOpen] = useState(false)
  const { setNodeRef: setDragRef, attributes, listeners, isDragging } = useDraggable({ id: entry.id ?? -1 })

  function handleEdit(target: LogEntry) {
    setDetailOpen(false)
    if (target.id === undefined) return
    // Real food-database and recipe entries have their own rich editor
    // (AddFoodPage); everything else -- custom entries and barcode-scanned
    // entries, which have neither foodId nor recipeId -- shares the simple
    // quick-add editor, which falls back to the entry's own top-level
    // fields when there's no customSnapshot yet (see QuickAddPage).
    navigate(
      target.foodId || target.recipeId ? `/log/edit/${target.id}` : `/log/quick-add?entryId=${target.id}`
    )
  }

  return (
    <motion.div
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <SwipeToDeleteRow onDelete={() => onSwipeDelete(entry)} deleteLabel="Delete">
        <div className="flex items-center dark:bg-surface-dark-card">
          {draggable && entry.id !== undefined && (
            <span
              ref={setDragRef}
              {...attributes}
              {...listeners}
              aria-label={`Reorder ${entry.name} to another meal`}
              data-testid={`entry-drag-handle-${entry.id}`}
              className={`flex min-h-touch min-w-touch shrink-0 touch-none items-center justify-center rounded-full transition-colors ${
                isDragging
                  ? 'bg-brand-100 text-brand-700 dark:bg-slate-700 dark:text-brand-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              <DragHandleIcon />
            </span>
          )}
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            aria-label={`Edit ${entry.name}`}
            data-testid={`entry-row-${entry.id}`}
            className={`flex min-h-touch flex-1 items-center gap-3 py-2 text-left ${draggable ? 'pr-3' : 'px-3'}`}
          >
            <FoodGlyph name={entry.name} size="small" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-medium text-slate-800 dark:text-slate-100">{entry.name}</p>
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
        </div>
      </SwipeToDeleteRow>

      <EntryDetailSheet open={detailOpen} onClose={() => setDetailOpen(false)} entry={entry} onEdit={handleEdit} />
    </motion.div>
  )
}
