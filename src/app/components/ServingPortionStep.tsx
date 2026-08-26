import { useState } from 'react'
import {
  computeMacrosForGrams,
  computeMacrosForServings,
  type MacroTotals,
  type Per100g,
} from '../../domain/logging/portionMath'
import type { PortionSaveData } from './PortionStep'

interface Props {
  per100g: Per100g
  /** The source's own per-serving macros (e.g. Open Food Facts' label figures), preferred over recomputing from per100g when present. */
  perServing?: MacroTotals
  /** Grams for one serving — required for this step to make sense; callers should fall back to PortionStep when this is unknown. */
  servingSize: number
  /** Raw serving-size text from the source, e.g. "325 ml", shown for context. */
  servingSizeText?: string
  onSave: (data: PortionSaveData) => void | Promise<void>
  /** Escape hatch back to the plain grams-first entry (e.g. a partial can, or a size the standard serving doesn't match). */
  onSwitchToGrams: () => void
}

const QUICK_SERVINGS = [1, 2, 3]

function formatServings(count: number): string {
  return count === 1 ? '1 serving' : `${count} servings`
}

export default function ServingPortionStep({
  per100g,
  perServing,
  servingSize,
  servingSizeText,
  onSave,
  onSwitchToGrams,
}: Props) {
  const [servingsValue, setServingsValue] = useState('1')

  const servings = Number(servingsValue) || 0
  const grams = Math.round(servingSize * servings * 10) / 10
  const preview =
    servings > 0
      ? perServing
        ? computeMacrosForServings(perServing, servings)
        : computeMacrosForGrams(per100g, grams)
      : null

  async function handleSave() {
    if (!preview || servings <= 0) return
    await onSave({
      portionSummary: formatServings(servings),
      qty: servings,
      unit: 'grams',
      grams,
      kcal: preview.kcal,
      p: preview.p,
      c: preview.c,
      f: preview.f,
    })
  }

  return (
    <div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Servings</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.5"
          data-testid="portion-servings-input"
          className="min-h-touch rounded border border-slate-300 px-3 py-2 text-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          value={servingsValue}
          onChange={(e) => setServingsValue(e.target.value)}
          autoFocus
          onFocus={(e) => e.target.select()}
        />
        {servingSizeText && (
          <span className="text-caption text-slate-500 dark:text-slate-400">
            1 serving = {servingSizeText}
          </span>
        )}
      </label>

      <div className="mt-2 flex flex-wrap gap-2">
        {QUICK_SERVINGS.map((count) => (
          <button
            key={count}
            type="button"
            data-testid={`serving-chip-${count}`}
            onClick={() => setServingsValue(String(count))}
            className="min-h-touch rounded-full border border-brand-700 px-3 py-1 text-caption text-brand-700 dark:border-brand-400 dark:text-brand-400"
          >
            {formatServings(count)}
          </button>
        ))}
      </div>

      {preview && (
        <p
          className="mt-3 text-sm tabular-nums text-slate-600 dark:text-slate-300"
          data-testid="entry-preview"
        >
          {Math.round(preview.kcal)} kcal · {preview.p}p / {preview.c}c / {preview.f}f
        </p>
      )}

      <button
        type="button"
        disabled={!preview || servings <= 0}
        onClick={handleSave}
        data-testid="log-entry-button"
        className="mt-4 min-h-touch w-full rounded bg-brand-700 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {preview ? `Add ${formatServings(servings)} · ${Math.round(preview.kcal)} kcal` : 'Add'}
      </button>

      <button
        type="button"
        onClick={onSwitchToGrams}
        data-testid="switch-to-grams-link"
        className="mt-2 min-h-touch text-caption text-slate-500 underline dark:text-slate-400"
      >
        Enter grams manually
      </button>
    </div>
  )
}
