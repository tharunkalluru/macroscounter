import type { LogEntry } from '../../data/models'
import { LogRepo } from '../../data/repos/LogRepo'
import { vibrateTiny } from '../../lib/haptics'
import BottomSheet from '../shell/BottomSheet'
import { useUIState } from '../shell/UIStateContext'
import PortionStep, { type PortionSaveData } from './PortionStep'

interface Props {
  open: boolean
  onClose: () => void
  entry: LogEntry | null
  onEdit: (entry: LogEntry) => void
}

const MACRO_ROWS: { key: 'p' | 'c' | 'f'; label: string; colorClass: string }[] = [
  { key: 'p', label: 'Protein', colorClass: 'bg-protein-500' },
  { key: 'c', label: 'Carbs', colorClass: 'bg-carbs-500' },
  { key: 'f', label: 'Fat', colorClass: 'bg-fat-500' },
]

/** Shows a logged entry's full macro breakdown before editing — reached by tapping any EntryRow. */
export default function EntryDetailSheet({ open, onClose, entry, onEdit }: Props) {
  const { notifyDataChanged } = useUIState()

  // A grams-denominated entry (from search, scan, or a recipe -- anything
  // logged as an actual quantity of something, not a fixed custom value)
  // carries enough information to derive its own per-100g density directly
  // from its already-logged totals, so serving size can be edited in place
  // here with the other fields recomputed live -- no lookup of the original
  // food/product/recipe needed. A fixed custom entry (grams === 0, e.g.
  // "Restaurant meal, 600 kcal" from quick-add) has no portion concept to
  // scale from; those stay read-only here, edited via the full form instead.
  const per100g =
    entry && entry.grams > 0
      ? {
          kcal: (entry.kcal / entry.grams) * 100,
          p: (entry.p / entry.grams) * 100,
          c: (entry.c / entry.grams) * 100,
          f: (entry.f / entry.grams) * 100,
        }
      : null

  async function handleSavePortion(data: PortionSaveData) {
    if (!entry || entry.id === undefined) return
    await new LogRepo().updateEntry(entry.id, data)
    vibrateTiny()
    notifyDataChanged()
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={entry?.name ?? ''}>
      {entry && (
        <div className="flex flex-col gap-4" data-testid="entry-detail-content">
          {per100g ? (
            <PortionStep
              per100g={per100g}
              referencePortions={[]}
              initialGrams={entry.grams}
              saveLabel="Save changes"
              onSave={handleSavePortion}
            />
          ) : (
            <>
              <p className="text-caption text-slate-500 dark:text-slate-400">{entry.portionSummary}</p>

              <div className="rounded-card bg-brand-50 p-4 text-center dark:bg-slate-800">
                <p className="text-caption text-slate-500 dark:text-slate-400">Calories</p>
                <p className="text-title font-semibold tabular-nums text-brand-700 dark:text-brand-400">
                  {Math.round(entry.kcal)} kcal
                </p>
              </div>

              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {MACRO_ROWS.map((macro) => (
                  <li
                    key={macro.key}
                    className="flex items-center justify-between py-3 text-slate-900 dark:text-slate-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${macro.colorClass}`} aria-hidden="true" />
                      <span>{macro.label}</span>
                    </div>
                    <span className="tabular-nums text-slate-600 dark:text-slate-300">
                      {Math.round(entry[macro.key] * 10) / 10} g
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <button
            type="button"
            onClick={() => onEdit(entry)}
            data-testid="entry-detail-edit-button"
            className="min-h-touch w-full rounded-card border border-slate-300 px-4 py-2.5 font-medium text-slate-700 transition-transform active:scale-[0.98] dark:border-slate-600 dark:text-slate-300"
          >
            {per100g ? 'Edit name or food' : 'Edit'}
          </button>
        </div>
      )}
    </BottomSheet>
  )
}
