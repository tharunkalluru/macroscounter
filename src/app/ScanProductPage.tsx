import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Meal, ScannedProduct } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { ScannedProductRepo } from '../data/repos/ScannedProductRepo'
import { getServingOptions } from '../domain/barcode/servingOptions'
import { lookupProduct } from '../domain/barcode/lookupProduct'
import { activeMealWindow } from '../domain/mealPrompt/activeMealWindow'
import { todayISO } from '../lib/date'
import { vibrateTiny } from '../lib/haptics'
import PortionStep, { type PortionSaveData } from './components/PortionStep'

const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
}
const MEALS: Meal[] = ['breakfast', 'lunch', 'snacks', 'dinner']

function Pulse({ className }: { className: string }) {
  return <div className={`motion-safe:animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`} />
}

function ProductCardSkeleton() {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-surface-dark-card" data-testid="product-card-skeleton">
      <div className="flex items-center gap-3">
        <Pulse className="h-16 w-16 shrink-0 rounded" />
        <div className="min-w-0 flex-1">
          <Pulse className="h-5 w-3/4" />
          <Pulse className="mt-2 h-3 w-1/3" />
        </div>
      </div>
      <Pulse className="mt-4 h-3 w-1/2" />
      <Pulse className="mt-4 h-10 w-full" />
    </div>
  )
}

export default function ScanProductPage() {
  const { barcode } = useParams<{ barcode: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const requestedMeal = searchParams.get('meal') as Meal | null
  const [meal, setMeal] = useState<Meal>(requestedMeal || activeMealWindow(new Date()) || 'breakfast')

  const [product, setProduct] = useState<ScannedProduct | null | undefined>(undefined)

  useEffect(() => {
    if (!barcode) return
    let cancelled = false
    ;(async () => {
      const result = await lookupProduct(barcode, {
        scannedProductRepo: new ScannedProductRepo(),
        fdcApiKey: import.meta.env.VITE_FDC_API_KEY || undefined,
      })
      if (cancelled) return
      if (result.product) {
        setProduct(result.product)
      } else {
        navigate(`/scan/not-found/${barcode}?meal=${meal}`, { replace: true })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcode])

  async function handleSave(data: PortionSaveData) {
    if (!product || !barcode) return
    await new LogRepo().addEntry({
      date: todayISO(),
      meal,
      barcode: product.barcode,
      name: product.name,
      ...data,
    })
    vibrateTiny()
    navigate('/')
  }

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <Link
        to="/scan"
        className="mb-4 inline-flex min-h-touch items-center text-sm text-brand-700 dark:text-brand-400 underline"
      >
        ← Back to scan
      </Link>

      {product === undefined && <ProductCardSkeleton />}

      {product === null && (
        <p className="text-slate-500 dark:text-slate-400">Product not found in the local cache.</p>
      )}

      {product && (
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-surface-dark-card">
          <div className="flex items-start gap-3">
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded object-cover"
                data-testid="scanned-product-image"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h1 className="font-semibold" data-testid="scanned-product-name">
                  {product.name}
                </h1>
                <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-caption text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                  {product.source}
                </span>
              </div>
              {product.brand && (
                <p className="text-caption text-slate-500 dark:text-slate-400">{product.brand}</p>
              )}
              <p className="mt-1 text-caption tabular-nums text-slate-500 dark:text-slate-400">
                Per 100 g: {Math.round(product.per100g.kcal)} kcal · {product.per100g.p}p /{' '}
                {product.per100g.c}c / {product.per100g.f}f
              </p>
            </div>
          </div>

          <label className="mt-4 flex flex-col gap-1">
            <span className="text-sm font-medium">Meal</span>
            <select
              className="min-h-touch rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              data-testid="scanned-product-meal-select"
              value={meal}
              onChange={(e) => setMeal(e.target.value as Meal)}
            >
              {MEALS.map((m) => (
                <option key={m} value={m}>
                  {MEAL_LABELS[m]}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-3">
            <PortionStep
              per100g={product.per100g}
              referencePortions={getServingOptions(product)}
              quickGrams={[]}
              onSave={handleSave}
            />
          </div>
        </div>
      )}
    </div>
  )
}
