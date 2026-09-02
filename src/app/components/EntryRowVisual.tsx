import type { LogEntry } from '../../data/models'
import { formatPortion } from '../../domain/logging/formatPortion'
import FoodGlyph from './FoodGlyph'

interface Props {
  entry: LogEntry
}

/** The glyph + name + portion/kcal caption shared by EntryRow's real row and LogPage's DragOverlay, so the floating drag preview looks identical to the row being dragged instead of a stripped-down substitute. */
export default function EntryRowVisual({ entry }: Props) {
  return (
    <>
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
    </>
  )
}
