import type { LogEntry } from '../../data/models'
import { formatPortion } from '../../domain/logging/formatPortion'
import FoodGlyph from './FoodGlyph'

interface Props {
  entry: LogEntry
}

/** Shared with the drag preview so moving a meal preserves its appearance. */
export default function EntryRowVisual({ entry }: Props) {
  return (
    <>
      <FoodGlyph name={entry.name} />
      <div className="min-w-0 flex-1 py-1">
        <p className="truncate text-body font-medium text-slate-900 dark:text-slate-100">{entry.name}</p>
        <p className="mt-0.5 truncate text-caption text-slate-500 dark:text-slate-400">
          {formatPortion({
            qty: entry.qty,
            unit: entry.unit,
            grams: entry.grams,
            portionLabel: entry.portionLabel,
            isCustom: !!entry.customSnapshot,
          })}
        </p>
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <p className="text-body font-semibold text-slate-900 dark:text-slate-100">{Math.round(entry.kcal)}</p>
        <p className="mt-0.5 text-caption text-slate-500 dark:text-slate-400">kcal</p>
      </div>
    </>
  )
}
