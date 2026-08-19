import { useState } from 'react'
import { computeMacrosForGrams } from '../../domain/logging/portionMath'
import { nameOf, per100gOf, portionsOf, type Selected } from '../foodSelection'

export interface PortionSaveData {
  portionSummary: string
  qty: number
  unit: 'grams'
  grams: number
  kcal: number
  p: number
  c: number
  f: number
}

interface Props {
  selected: Selected
  /** Pre-fills the field (edit mode: the entry's current grams). Defaults to the food's typical serving. */
  initialGrams?: number
  /** Overrides the button's dynamic "Add {g} g · {kcal} kcal" text — used for edit mode ("Save changes"). */
  saveLabel?: string
  onChangeFood: () => void
  onSave: (data: PortionSaveData) => void | Promise<void>
}

const QUICK_GRAMS = [50, 100, 150, 200]

/**
 * Grams-first portion entry (Phase 10.4): a single grams field is the only
 * way to set a quantity. Household-unit reference portions ("1 idli") are
 * rendered as gram-filling shortcuts, not a stored unit — every entry this
 * writes is `unit: 'grams'`, matching the spec's "household units become
 * gram shortcuts, never the stored unit."
 */
export default function PortionStep({ selected, initialGrams, saveLabel, onChangeFood, onSave }: Props) {
  const portions = portionsOf(selected)
  const [gramsValue, setGramsValue] = useState(String(initialGrams ?? portions[0]?.grams ?? 100))

  const grams = Number(gramsValue) || 0
  const preview = grams > 0 ? computeMacrosForGrams(per100gOf(selected), grams) : null

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
    })
  }

  return (
    <div className="rounded-card bg-white dark:bg-surface-dark-card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{nameOf(selected)}</h3>
        <button
          type="button"
          className="min-h-touch text-sm text-slate-500 dark:text-slate-400 underline"
          onClick={onChangeFood}
        >
          Change
        </button>
      </div>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-sm font-medium">Grams</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          data-testid="portion-grams-input"
          className="min-h-touch rounded border border-slate-300 px-3 py-2 text-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          value={gramsValue}
          onChange={(e) => setGramsValue(e.target.value)}
          autoFocus
          onFocus={(e) => e.target.select()}
        />
      </label>

      <div className="mt-2 flex flex-wrap gap-2">
        {QUICK_GRAMS.map((g) => (
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
        {portions.map((portion) => (
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
