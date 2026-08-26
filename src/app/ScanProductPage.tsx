import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Meal, ScannedProduct } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { ScannedProductRepo } from '../data/repos/ScannedProductRepo'
import { getServingOptions } from '../domain/barcode/servingOptions'
import { lookupProduct } from '../domain/barcode/lookupProduct'
import { parseServingSize } from '../domain/barcode/servingSizeParser'
import { activeMealWindow } from '../domain/mealPrompt/activeMealWindow'
import { todayISO } from '../lib/date'
import { vibrateTiny } from '../lib/haptics'
import PageHeader from './components/PageHeader'
import PortionStep, { type PortionSaveData } from './components/PortionStep'
import SegmentedControl from './components/SegmentedControl'
import ServingPortionStep from './components/ServingPortionStep'
import { Pulse } from './components/Skeleton'

const MEAL_OPTIONS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'dinner', label: 'Dinner' },
]

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
  const [mode, setMode] = useState<'servings' | 'grams'>('grams')

  // Re-parses the raw serving-size text on every read rather than trusting
  // the pre-computed `servingSize` field: that field can be cached from a
  // scan made before a servingSizeParser improvement (e.g. household-unit
  // formats like "1 bar (40g)" weren't handled originally), so a product
  // scanned once and cached would otherwise stay stuck on the old, narrower
  // parse forever. Re-deriving from the always-preserved raw text means an
  // already-cached product benefits from parser fixes without a re-fetch.
  const servingSize = product ? (parseServingSize(product.servingSizeText) ?? product.servingSize) : undefined

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
        const size = parseServingSize(result.product.servingSizeText) ?? result.product.servingSize
        setMode(size !== undefined ? 'servings' : 'grams')
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
      <PageHeader title="Scan result" backTo="/scan" backLabel="Back to scan" />

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
                <h2 className="font-semibold" data-testid="scanned-product-name">
                  {product.name}
                </h2>
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

          <div className="mt-4">
            <SegmentedControl
              label="Meal"
              options={MEAL_OPTIONS}
              value={meal}
              onChange={setMeal}
              testIdPrefix="scanned-product-meal"
            />
          </div>

          <div className="mt-3">
            {mode === 'servings' && servingSize !== undefined ? (
              <ServingPortionStep
                per100g={product.per100g}
                perServing={product.perServing}
                servingSize={servingSize}
                servingSizeText={product.servingSizeText}
                onSave={handleSave}
                onSwitchToGrams={() => setMode('grams')}
              />
            ) : (
              <>
                <PortionStep
                  per100g={product.per100g}
                  referencePortions={getServingOptions({ ...product, servingSize })}
                  quickGrams={[]}
                  onSave={handleSave}
                />
                {servingSize !== undefined && (
                  <button
                    type="button"
                    onClick={() => setMode('servings')}
                    data-testid="switch-to-servings-link"
                    className="mt-2 min-h-touch text-caption text-slate-500 underline dark:text-slate-400"
                  >
                    Use standard serving
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
