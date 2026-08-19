import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Meal, ScannedProduct } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { ScannedProductRepo } from '../data/repos/ScannedProductRepo'
import { computeMacrosForGrams, gramsForPortion } from '../domain/logging/portionMath'
import { getServingOptions } from '../domain/barcode/servingOptions'
import { todayISO } from '../lib/date'
import { vibrateTiny } from '../lib/haptics'

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
}

export default function ScanProductPage() {
  const { barcode } = useParams<{ barcode: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const meal = (searchParams.get('meal') as Meal) || 'breakfast'

  const [product, setProduct] = useState<ScannedProduct | null | undefined>(undefined)
  const [portionIndex, setPortionIndex] = useState(0)
  const [qty, setQty] = useState('1')

  useEffect(() => {
    if (!barcode) return
    new ScannedProductRepo().get(barcode).then((p) => setProduct(p ?? null))
  }, [barcode])

  const portions = useMemo(() => (product ? getServingOptions(product) : []), [product])

  const grams = portions[portionIndex]
    ? gramsForPortion(Number(qty) || 0, portions[portionIndex].grams)
    : 0
  const preview = product && grams > 0 ? computeMacrosForGrams(product.per100g, grams) : null

  async function handleSave() {
    if (!product || !preview || !barcode) return
    await new LogRepo().addEntry({
      date: todayISO(),
      meal,
      barcode: product.barcode,
      name: product.name,
      portionSummary: `${qty} x ${portions[portionIndex].label}`,
      portionLabel: portions[portionIndex].label,
      qty: Number(qty) || 0,
      unit: 'portion',
      grams,
      kcal: preview.kcal,
      p: preview.p,
      c: preview.c,
      f: preview.f,
    })
    vibrateTiny()
    navigate('/')
  }

  if (product === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    )
  }

  if (product === null) {
    return (
      <div className="mx-auto max-w-md px-6 py-8">
        <Link
          to="/scan"
          className="mb-4 inline-block text-sm text-brand-700 dark:text-brand-400 underline"
        >
          ← Back to scan
        </Link>
        <p className="text-slate-500 dark:text-slate-400">Product not found in the local cache.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <Link
        to="/scan"
        className="mb-4 inline-block text-sm text-brand-700 dark:text-brand-400 underline"
      >
        ← Back to scan
      </Link>

      <div className="rounded-lg bg-white dark:bg-surface-dark-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-semibold" data-testid="scanned-product-name">
              {product.name}
            </h1>
            {product.brand && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{product.brand}</p>
            )}
          </div>
          <span className="rounded bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
            {product.source}
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <select
            className="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2"
            value={portionIndex}
            onChange={(e) => setPortionIndex(Number(e.target.value))}
          >
            {portions.map((portion, i) => (
              <option key={portion.label} value={i}>
                {portion.label}
              </option>
            ))}
          </select>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Quantity</span>
            <input
              type="number"
              min="0"
              step="0.5"
              className="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 px-3 py-2"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
        </div>

        {preview && (
          <p
            className="mt-3 text-sm text-slate-600 dark:text-slate-300"
            data-testid="entry-preview"
          >
            {Math.round(preview.kcal)} kcal · {preview.p}p / {preview.c}c / {preview.f}f
          </p>
        )}

        <button
          type="button"
          disabled={!preview || grams <= 0}
          onClick={handleSave}
          className="mt-4 w-full rounded bg-brand-700 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          Add to {MEAL_LABELS[meal]}
        </button>
      </div>
    </div>
  )
}
