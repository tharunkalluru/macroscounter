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
    vi.fn(async () => new Response(JSON.stringify(offPayload), { status: 200 }))
  )
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await db.scannedProducts.delete(BARCODE)
  await db.logEntries.clear()
})

describe('ScanProductPage (Phase 10.5 integration: scan -> card -> one-tap add)', () => {
  it('shows a skeleton while the lookup is in flight, then the card prefilled with the serving grams', async () => {
    renderAt(`/scan/product/${BARCODE}?meal=lunch`)

    expect(screen.getByTestId('product-card-skeleton')).toBeInTheDocument()

    await screen.findByTestId('scanned-product-name')
    expect(screen.getByTestId('scanned-product-name')).toHaveTextContent('Amul Butter')
    expect(screen.getByTestId('scanned-product-image')).toHaveAttribute(
      'src',
      'https://images.openfoodfacts.org/amul-butter.jpg'
    )
    expect(screen.getByText('Per 100 g: 717 kcal · 0.5p / 0.1c / 80f')).toBeInTheDocument()

    // Pre-filled from the detected serving size (10 g), not a raw 100g default.
    expect(screen.getByTestId('portion-grams-input')).toHaveValue(10)
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
})
