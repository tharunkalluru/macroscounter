import { useId, useState } from 'react'
import { getMealDisplayName } from '../../domain/logging/foodDisplayName'
import type { SuggestionChip } from '../../domain/logging/suggestions'
import { ChevronRightIcon, PlusIcon } from '../shell/icons'

interface Props {
  chip: SuggestionChip
  onAdd: () => void
  addTestId: string
  disabled?: boolean
  pending?: boolean
  added?: boolean
  showFrequency?: boolean
}

/** Inspect a suggestion without changing the diary; the separate + keeps repeat logging one tap. */
export default function MealSuggestionRow({ chip, onAdd, addTestId, disabled, pending, added, showFrequency }: Props) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const display = getMealDisplayName(chip.entries)
  const hasNutrition = chip.entries.every((entry) => entry.snapshot)
  const kcal = hasNutrition ? Math.round(chip.entries.reduce((sum, entry) => sum + entry.snapshot!.kcal, 0)) : null
  const portion = chip.entries.length === 1
    ? chip.entries[0].snapshot?.portionSummary ?? `${chip.entries[0].grams} g`
    : `${chip.entries.length} items`
  const description = [display.variant, portion, kcal === null ? null : `${kcal} kcal`].filter(Boolean).join(' · ')
  const accessibleName = display.fullName !== display.title
    ? `${display.title}: ${display.fullName}`
    : display.title

  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-white p-2 dark:border-slate-800 dark:bg-surface-dark-card" data-testid="meal-suggestion-row">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${expanded ? 'Hide' : 'Show'} details for ${accessibleName}`}
          className="flex min-h-touch min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          data-testid="meal-suggestion-details-toggle"
        >
          <span className="min-w-0 flex-1">
            <span data-testid="meal-suggestion-title" className="line-clamp-2 text-sm font-medium text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100">{display.title}</span>
            <span className="mt-0.5 line-clamp-2 text-caption text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">{description}</span>
          </span>
          <ChevronRightIcon className={`h-4 w-4 shrink-0 text-slate-400 ${expanded ? 'rotate-90' : ''}`} />
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          aria-label={`Add ${accessibleName}${added ? ' again' : ''}`}
          aria-busy={pending || undefined}
          data-testid={addTestId}
          className="pressable flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:opacity-50 dark:bg-brand-900/30 dark:text-brand-400"
        >
          {pending ? <span aria-hidden="true">…</span> : added ? <span aria-hidden="true">✓</span> : <PlusIcon className="h-5 w-5" />}
          {added && <span className="sr-only">Logged</span>}
        </button>
      </div>
      <div id={detailsId} data-testid="meal-suggestion-details" hidden={!expanded} className="mx-1 mt-2 border-t border-slate-100 pb-1 pt-3 dark:border-slate-800">
        <ul className="space-y-3">
          {chip.entries.map((entry, index) => (
            <li key={index} className="min-w-0 text-sm">
              <p className="font-medium text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">{entry.name}</p>
              <p className="mt-1 text-caption text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">
                {entry.snapshot?.portionSummary ?? `${entry.grams} g`}
                {entry.snapshot && ` · ${Math.round(entry.snapshot.kcal)} kcal`}
              </p>
              {entry.snapshot && <p className="mt-1 text-caption text-slate-500 dark:text-slate-400">
                {Math.round(entry.snapshot.p)} g protein · {Math.round(entry.snapshot.c)} g carbs · {Math.round(entry.snapshot.f)} g fat
              </p>}
              {entry.snapshot?.barcode && <p className="mt-1 text-caption text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">Barcode {entry.snapshot.barcode}</p>}
            </li>
          ))}
        </ul>
        {showFrequency && <p className="mt-3 text-caption text-slate-500 dark:text-slate-400">Logged {chip.count}×</p>}
      </div>
    </div>
  )
}
