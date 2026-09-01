import { motion, useReducedMotion } from 'framer-motion'
import type { LogEntry } from '../../data/models'
import { formatPortion } from '../../domain/logging/formatPortion'
import FoodGlyph from './FoodGlyph'
import SwipeToDeleteRow from './SwipeToDeleteRow'

interface Props {
  entry: LogEntry
  onTap: (entry: LogEntry) => void
  onSwipeDelete: (entry: LogEntry) => void
}

/** One log-entry row — tap to edit, swipe left to delete. Shared by MealSection and Today's flat entry list (Phase R.3) so both stay pixel-identical. */
export default function EntryRow({ entry, onTap, onSwipeDelete }: Props) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
    >
      <SwipeToDeleteRow onDelete={() => onSwipeDelete(entry)} deleteLabel="Delete">
        <button
          type="button"
          onClick={() => onTap(entry)}
          aria-label={`Edit ${entry.name}`}
          data-testid={`entry-row-${entry.id}`}
          className="flex min-h-touch w-full items-center gap-3 px-3 py-2 text-left dark:bg-surface-dark-card"
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
      </SwipeToDeleteRow>
    </motion.div>
  )
}
