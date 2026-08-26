import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../data/db'
import { LogRepo } from '../data/repos/LogRepo'
import { todayISO } from '../lib/date'

// Isolates the "defaults to the active meal window" assertion from real
// wall-clock time — activeMealWindow's own boundary logic already has 15
// dedicated unit tests (Phase 10.3); this only verifies ScanProductPage
// wires its return value into the meal selector correctly.
vi.mock('../domain/mealPrompt/activeMealWindow', () => ({
  activeMealWindow: () => 'snacks',
}))

const ScanProductPage = (await import('./ScanProductPage')).default

const BARCODE = '8901491101615'

const offPayload = {
  status: 1,
  product: {
    product_name: 'Amul Butter',
    brands: 'Amul',
    quantity: '500 g',
    serving_size: '10 g',
    image_url: 'https://images.openfoodfacts.org/amul-butter.jpg',
    nutriments: {
      'energy-kcal_100g': 717,
      proteins_100g: 0.5,
      carbohydrates_100g: 0.1,
      fat_100g: 80,
    },
  },
}

const PROTEIN_SHAKE_BARCODE = '8901491101622'

const proteinShakePayload = {
  status: 1,
  product: {
    product_name: 'Protein Shake',
    brands: 'FitFuel',
    serving_size: '325 ml',
    nutriments: {
      'energy-kcal_100g': 49.2,
      proteins_100g: 6.2,
      carbohydrates_100g: 3.7,
      fat_100g: 0.9,
      // The label's own declared per-serving figures -- deliberately NOT an
      // exact per100g x 3.25 multiple, since that's the whole point:
      // manufacturers round these independently.
      'energy-kcal_serving': 160,
      proteins_serving: 20,
      carbohydrates_serving: 12,
      fat_serving: 3,
    },
  },
}

const GRANOLA_BAR_BARCODE = '8901491101639'

const granolaBarPayload = {
  status: 1,
  product: {
    product_name: 'Granola Bar',
    brands: 'NutriSnack',
    // Real-world Open Food Facts format: a household-unit description with
    // the gram equivalent in parentheses, not a bare "35 g" -- the exact
    // format that was reported live as "still showing grams instead of
    // servings" (parseServingSize didn't handle this shape before).
    serving_size: '1 bar (35g)',
    nutriments: {
      'energy-kcal_100g': 450,
      proteins_100g: 8,
      carbohydrates_100g: 60,
      fat_100g: 18,
    },
  },
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/scan/product/:barcode" element={<ScanProductPage />} />
        <Route path="/" element={<div data-testid="today-stub" />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const payload = url.includes(PROTEIN_SHAKE_BARCODE)
        ? proteinShakePayload
        : url.includes(GRANOLA_BAR_BARCODE)
          ? granolaBarPayload
          : offPayload
      return new Response(JSON.stringify(payload), { status: 200 })
    })
  )
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await db.scannedProducts.delete(BARCODE)
  await db.scannedProducts.delete(PROTEIN_SHAKE_BARCODE)
  await db.scannedProducts.delete(GRANOLA_BAR_BARCODE)
  await db.logEntries.clear()
})

describe('ScanProductPage (Phase 10.5 integration: scan -> card -> one-tap add)', () => {
  it('shows a skeleton while the lookup is in flight, then the card defaulted to 1 serving', async () => {
    renderAt(`/scan/product/${BARCODE}?meal=lunch`)

    expect(screen.getByTestId('product-card-skeleton')).toBeInTheDocument()

    await screen.findByTestId('scanned-product-name')
    expect(screen.getByTestId('scanned-product-name')).toHaveTextContent('Amul Butter')
    expect(screen.getByTestId('scanned-product-image')).toHaveAttribute(
      'src',
      'https://images.openfoodfacts.org/amul-butter.jpg'
    )
    expect(screen.getByText('Per 100 g: 717 kcal · 0.5p / 0.1c / 80f')).toBeInTheDocument()

    // A known serving size (10 g) defaults the entry to a servings-first
    // step, prefilled at 1 serving, rather than a raw grams field.
    expect(screen.getByTestId('portion-servings-input')).toHaveValue(1)
    expect(screen.getByText('1 serving = 10 g')).toBeInTheDocument()
    expect(screen.getByTestId('entry-preview')).toHaveTextContent('72 kcal') // 71.7 -> rounds to 72
  })

  it('one-tap add logs the entry to the meal passed in the URL', async () => {
    renderAt(`/scan/product/${BARCODE}?meal=lunch`)
    await screen.findByTestId('scanned-product-name')

    fireEvent.click(screen.getByTestId('log-entry-button'))

    await waitFor(async () => {
      const entries = await new LogRepo(db).getEntriesForDate(todayISO())
      expect(entries.find((e) => e.barcode === BARCODE)).toMatchObject({
        meal: 'lunch',
        name: 'Amul Butter',
        grams: 10,
        unit: 'grams',
        portionSummary: '1 serving',
      })
    })
  })

  it('"Enter grams manually" and "Use standard serving" toggle between the two entry modes', async () => {
    renderAt(`/scan/product/${BARCODE}?meal=lunch`)
    await screen.findByTestId('scanned-product-name')

    expect(screen.getByTestId('portion-servings-input')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('switch-to-grams-link'))

    expect(screen.getByTestId('portion-grams-input')).toHaveValue(10)
    fireEvent.click(screen.getByTestId('switch-to-servings-link'))

    expect(screen.getByTestId('portion-servings-input')).toBeInTheDocument()
  })

  it('a product with the source\'s own per-serving figures uses them directly, not a per100g recomputation', async () => {
    renderAt(`/scan/product/${PROTEIN_SHAKE_BARCODE}?meal=breakfast`)
    await screen.findByTestId('scanned-product-name')

    // These are the label's own 160/20/12/3 figures. A per100g recomputation
    // (49.2/6.2/3.7/0.9 per 100g x 325g) would instead give 20.2p / 2.9f --
    // close enough on kcal/carbs to look right, but visibly wrong on
    // protein/fat, which is exactly the drift this feature fixes.
    expect(screen.getByTestId('entry-preview')).toHaveTextContent('160 kcal · 20p / 12c / 3f')

    fireEvent.click(screen.getByTestId('serving-chip-2'))
    // Exactly double the label's own per-serving figures (perServing x 2),
    // not per100g x (325*2)/100 which would give 40.3p / 5.9f instead.
    expect(screen.getByTestId('entry-preview')).toHaveTextContent('320 kcal · 40p / 24c / 6f')

    fireEvent.click(screen.getByTestId('log-entry-button'))

    await waitFor(async () => {
      const entries = await new LogRepo(db).getEntriesForDate(todayISO())
      expect(entries.find((e) => e.barcode === PROTEIN_SHAKE_BARCODE)).toMatchObject({
        kcal: 320,
        p: 40,
        c: 24,
        f: 6,
        portionSummary: '2 servings',
      })
    })
  })

  it('with no meal in the URL, the meal selector defaults to the active meal window', async () => {
    renderAt(`/scan/product/${BARCODE}`)
    await screen.findByTestId('scanned-product-name')

    expect(screen.getByTestId('scanned-product-meal-snacks')).toHaveAttribute('aria-checked', 'true')
  })

  it('the meal selector is changeable, and the logged entry uses whatever is currently selected', async () => {
    renderAt(`/scan/product/${BARCODE}?meal=breakfast`)
    await screen.findByTestId('scanned-product-name')

    fireEvent.click(screen.getByTestId('scanned-product-meal-dinner'))
    fireEvent.click(screen.getByTestId('log-entry-button'))

    await waitFor(async () => {
      const entries = await new LogRepo(db).getEntriesForDate(todayISO())
      expect(entries.find((e) => e.barcode === BARCODE)?.meal).toBe('dinner')
    })
  })

  it('a rescan of an already-cached barcode never touches the network', async () => {
    // First render caches the product (via the mocked fetch above).
    const { unmount } = renderAt(`/scan/product/${BARCODE}?meal=lunch`)
    await screen.findByTestId('scanned-product-name')
    unmount()

    const fetchMock = vi.mocked(fetch)
    fetchMock.mockClear()

    renderAt(`/scan/product/${BARCODE}?meal=dinner`)
    await screen.findByTestId('scanned-product-name')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a household-unit serving_size like "1 bar (35g)" still defaults to servings mode', async () => {
    renderAt(`/scan/product/${GRANOLA_BAR_BARCODE}?meal=snacks`)
    await screen.findByTestId('scanned-product-name')

    expect(screen.getByTestId('portion-servings-input')).toHaveValue(1)
    expect(screen.getByText('1 serving = 1 bar (35g)')).toBeInTheDocument()
    // 450 kcal/100g x 35g = 157.5 -> rounds to 158.
    expect(screen.getByTestId('entry-preview')).toHaveTextContent('158 kcal')
  })

  it('an already-cached product whose serving size was unparsable under an older parser still gets servings mode on re-read', async () => {
    // Simulates a product scanned and cached before parseServingSize handled
    // "1 bar (35g)" -- servingSize came back undefined at cache-write time,
    // but the raw servingSizeText was preserved. The fix must re-derive from
    // that raw text on read, not trust the stale precomputed field forever.
    await db.scannedProducts.put({
      barcode: GRANOLA_BAR_BARCODE,
      name: 'Granola Bar',
      brand: 'NutriSnack',
      per100g: { kcal: 450, p: 8, c: 60, f: 18 },
      servingSize: undefined,
      servingSizeText: '1 bar (35g)',
      source: 'off',
      firstScanned: todayISO(),
    })

    renderAt(`/scan/product/${GRANOLA_BAR_BARCODE}?meal=snacks`)
    await screen.findByTestId('scanned-product-name')

    expect(screen.getByTestId('portion-servings-input')).toBeInTheDocument()
    expect(screen.getByTestId('entry-preview')).toHaveTextContent('158 kcal')
  })
})
