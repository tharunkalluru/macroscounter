import type { LogEntry } from '../../data/models'
import { formatPortion } from '../../domain/logging/formatPortion'
import { getFoodDisplayName } from '../../domain/logging/foodDisplayName'
import { ChevronRightIcon } from '../shell/icons'
import FoodGlyph from './FoodGlyph'

interface Props {
  entry: LogEntry
}

/** Shared with the drag preview so moving a meal preserves its appearance. */
export default function EntryRowVisual({ entry }: Props) {
  const displayName = getFoodDisplayName(entry.name)
  return (
    <>
      <FoodGlyph name={entry.name} />
      <div className="min-w-0 flex-1 py-1">
        <p className="truncate text-body font-medium text-slate-900 dark:text-slate-100" data-testid="entry-display-name">{displayName.title}</p>
        <p className="mt-0.5 truncate text-caption text-slate-500 dark:text-slate-400">
          {displayName.variant && <>{displayName.variant} · </>}
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
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
    </>
  )
}
