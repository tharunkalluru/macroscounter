import { useState } from 'react'
import { computeMacrosForGrams, type Per100g } from '../../domain/logging/portionMath'
import type { Portion } from '../../domain/fooddb/types'
import type { Unit } from '../../data/models'

export interface PortionSaveData {
  portionSummary: string
  qty: number
  unit: Unit
  /** The picked household portion's label (e.g. "1 idli"), set only when unit === 'portion'. */
  portionLabel?: string
  grams: number
  kcal: number
  p: number
  c: number
  f: number
  fiber?: number
}

interface Props {
  per100g: Per100g
  /** Household-unit shortcuts rendered as gram-filling chips, e.g. "1 idli" or "1 pack". */
  referencePortions: Portion[]
  /** Fixed quick-adjust values shown alongside the reference portions. Pass `[]` to omit (e.g. a scanned product's own pack-based options are already enough). */
  quickGrams?: number[]
  /** Pre-fills the field (edit mode: the entry's current grams). Defaults to the first reference portion. */
  initialGrams?: number
  /** Overrides the button's dynamic "Add {g} g · {kcal} kcal" text — used for edit mode ("Save changes"). */
  saveLabel?: string
  onSave: (data: PortionSaveData) => void | Promise<void>
}

const DEFAULT_QUICK_GRAMS = [50, 100, 150, 200]

/**
 * Grams-first portion entry (Phase 10.4, reused for the scanned-product card
 * in 10.5): a single grams field is the only way to set a quantity.
 * Household-unit reference portions ("1 idli", "1 pack") are rendered as
 * gram-filling shortcuts, not a stored unit — every entry this writes is
 * `unit: 'grams'`, matching the spec's "household units become gram
 * shortcuts, never the stored unit."
 */
export default function PortionStep({
  per100g,
  referencePortions,
  quickGrams = DEFAULT_QUICK_GRAMS,
  initialGrams,
  saveLabel,
  onSave,
}: Props) {
  const [gramsValue, setGramsValue] = useState(
    String(initialGrams ?? referencePortions[0]?.grams ?? 100)
  )

  const grams = Number(gramsValue) || 0
  const preview = grams > 0 ? computeMacrosForGrams(per100g, grams) : null

  function step(delta: number) {
    setGramsValue(String(Math.max(0, grams + delta)))
  }

  async function handleSave() {
    if (!preview || grams <= 0) return
    await onSave({
      portionSummary: `${grams} g`,
      qty: grams,
      unit: 'grams',
      grams,
      kcal: preview.kcal,
      p: preview.p,
      c: preview.c,
      f: preview.f,
      fiber: preview.fiber,
    })
  }

  return (
    <div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Grams</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-10)}
            aria-label="Decrease by 10 grams"
            data-testid="portion-grams-decrement"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-full border border-slate-300 text-lg font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300"
          >
            −
          </button>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            data-testid="portion-grams-input"
            className="min-h-touch flex-1 rounded border border-slate-300 px-3 py-2 text-center text-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={gramsValue}
            onChange={(e) => setGramsValue(e.target.value)}
            autoFocus
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={() => step(10)}
            aria-label="Increase by 10 grams"
            data-testid="portion-grams-increment"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-full border border-slate-300 text-lg font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300"
          >
            +
          </button>
        </div>
      </label>

      <div className="mt-2 flex flex-wrap gap-2">
        {quickGrams.map((g) => (
          <button
            key={g}
            type="button"
            data-testid={`gram-chip-${g}`}
            onClick={() => setGramsValue(String(g))}
            className="min-h-touch rounded-full border border-slate-300 px-3 py-1 text-caption text-slate-700 dark:border-slate-600 dark:text-slate-300"
          >
            {g} g
          </button>
        ))}
        {referencePortions.map((portion) => (
          <button
            key={portion.label}
            type="button"
            data-testid="gram-chip-portion"
            onClick={() => setGramsValue(String(portion.grams))}
            className="min-h-touch rounded-full border border-brand-700 px-3 py-1 text-caption text-brand-700 dark:border-brand-400 dark:text-brand-400"
          >
            {portion.label} ≈ {portion.grams} g
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
        disabled={!preview || grams <= 0}
        onClick={handleSave}
        data-testid="log-entry-button"
        className="mt-4 min-h-touch w-full rounded bg-brand-700 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {saveLabel ?? (preview ? `Add ${Math.round(grams)} g · ${Math.round(preview.kcal)} kcal` : 'Add')}
      </button>
    </div>
  )
}
