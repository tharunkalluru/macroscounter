import { useId, useRef, useState } from 'react'
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
  const gramsInputId = useId()
  const [gramsValue, setGramsValue] = useState(
    String(initialGrams ?? referencePortions[0]?.grams ?? 100)
  )
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const grams = Number(gramsValue) || 0
  const preview = Number.isFinite(grams) && grams > 0 ? computeMacrosForGrams(per100g, grams) : null
  const valid = preview !== null && [preview.kcal, preview.p, preview.c, preview.f, preview.fiber ?? 0].every((n) => Number.isFinite(n) && n >= 0)

  function step(delta: number) {
    setGramsValue(String(Math.max(0, grams + delta)))
  }

  async function handleSave() {
    if (!preview || !valid || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      await onSave({
        portionSummary: `${grams} g`,
        qty: grams,
        unit: 'grams',
        portionLabel: undefined,
        grams,
        kcal: preview.kcal,
        p: preview.p,
        c: preview.c,
        f: preview.f,
        fiber: preview.fiber,
      })
    } catch {
      setError('Could not save this entry. Please try again.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div>
      <div>
        <label htmlFor={gramsInputId} className="mb-2 block text-sm font-semibold text-slate-900 dark:text-slate-100">Grams</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => step(-10)}
            aria-label="Decrease by 10 grams"
            data-testid="portion-grams-decrement"
            className="pressable flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-medium text-slate-600 dark:border-slate-700 dark:bg-surface-dark-card dark:text-slate-300"
          >
            −
          </button>
          <input
            id={gramsInputId}
            type="number"
            inputMode="decimal"
            min="0"
            data-testid="portion-grams-input"
            className="min-h-touch min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-center text-lg font-semibold tabular-nums text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-surface-dark-card dark:text-slate-100"
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
            className="pressable flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-medium text-slate-600 dark:border-slate-700 dark:bg-surface-dark-card dark:text-slate-300"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {quickGrams.map((g) => (
          <button
            key={g}
            type="button"
            data-testid={`gram-chip-${g}`}
            aria-pressed={grams === g}
            onClick={() => setGramsValue(String(g))}
            className={`pressable min-h-touch rounded-xl border px-3 py-2 text-caption font-medium tabular-nums ${grams === g
              ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-slate-800 dark:text-brand-400'
              : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-surface-dark-card dark:text-slate-300'}`}
          >
            {g} g
          </button>
        ))}
        {referencePortions.map((portion) => (
          <button
            key={portion.label}
            type="button"
            data-testid="gram-chip-portion"
            aria-pressed={grams === portion.grams}
            onClick={() => setGramsValue(String(portion.grams))}
            className={`pressable min-h-touch rounded-xl border px-3 py-2 text-caption font-medium ${grams === portion.grams
              ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-slate-800 dark:text-brand-400'
              : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-surface-dark-card dark:text-slate-300'}`}
          >
            {portion.label} ≈ {portion.grams} g
          </button>
        ))}
      </div>

      {preview && (
        <p
          className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-sm font-medium tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          data-testid="entry-preview"
        >
          {Math.round(preview.kcal)} kcal · {preview.p}p / {preview.c}c / {preview.f}f
        </p>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="button"
        disabled={!valid || saving}
        aria-busy={saving}
        onClick={handleSave}
        data-testid="log-entry-button"
        className="pressable mt-4 min-h-touch w-full rounded-2xl bg-brand-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : saveLabel ?? (valid && preview ? `Add ${Math.round(grams)} g · ${Math.round(preview.kcal)} kcal` : 'Add')}
      </button>
    </div>
  )
}
