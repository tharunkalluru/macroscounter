import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import type { FoodRecord } from '../../data/models'
import { LogRepo } from '../../data/repos/LogRepo'
import { todayISO } from '../../lib/date'
import AddFoodSheetContent from './AddFoodSheetContent'

const fixtureFood: FoodRecord = {
  id: 'integration-test-idli',
  name: 'Integration Test Idli',
  aliases: [],
  category: 'south-indian',
  per100g: { kcal: 100, p: 4, c: 20, f: 1, fiber: 0 },
  portions: [{ label: '1 idli', grams: 40 }],
  source: 'test',
  verified: true,
}

beforeEach(async () => {
  await db.foods.put(fixtureFood)
})

afterEach(async () => {
  await db.foods.delete(fixtureFood.id)
  await db.logEntries.clear()
})

describe('search -> select -> type grams -> log (Phase 10.4 grams-first integration)', () => {
  it('produces a logged entry whose totals exactly match the gram->macro math', async () => {
    const onSaved = vi.fn()
    render(
      <MemoryRouter>
        <AddFoodSheetContent
          meal="breakfast"
          onSaved={onSaved}
          onRequestScan={vi.fn()}
          onRequestCustom={vi.fn()}
          onRequestNewRecipe={vi.fn()}
        />
      </MemoryRouter>
    )

    const searchInput = await screen.findByPlaceholderText('Search foods (e.g. idli, sambar)')
    fireEvent.change(searchInput, { target: { value: 'Integration Test Idli' } })

    const result = await screen.findByRole('button', { name: 'Integration Test Idli' })
    fireEvent.click(result)

    const gramsInput = await screen.findByTestId('portion-grams-input')
    expect(gramsInput).toHaveValue(40) // pre-filled from the food's typical (first) portion

    fireEvent.change(gramsInput, { target: { value: '180' } })
    await waitFor(() =>
      expect(screen.getByTestId('entry-preview')).toHaveTextContent('180 kcal · 7.2p / 36c / 1.8f')
    )
    expect(screen.getByTestId('log-entry-button')).toHaveTextContent('Add 180 g · 180 kcal')

    fireEvent.click(screen.getByTestId('log-entry-button'))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))

    const entries = await new LogRepo(db).getEntriesForDate(todayISO())
    const logged = entries.find((e) => e.foodId === fixtureFood.id)
    expect(logged).toMatchObject({
      meal: 'breakfast',
      name: 'Integration Test Idli',
      portionSummary: '180 g',
      qty: 180,
      unit: 'grams',
      grams: 180,
      kcal: 180,
      p: 7.2,
      c: 36,
      f: 1.8,
    })
  })

  it('a quick-adjust chip fills the field and logs that exact gram amount', async () => {
    const onSaved = vi.fn()
    render(
      <MemoryRouter>
        <AddFoodSheetContent
          meal="lunch"
          onSaved={onSaved}
          onRequestScan={vi.fn()}
          onRequestCustom={vi.fn()}
          onRequestNewRecipe={vi.fn()}
        />
      </MemoryRouter>
    )

    const searchInput = await screen.findByPlaceholderText('Search foods (e.g. idli, sambar)')
    fireEvent.change(searchInput, { target: { value: 'Integration Test Idli' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Integration Test Idli' }))

    await screen.findByTestId('portion-grams-input')
    fireEvent.click(screen.getByTestId('gram-chip-100'))
    expect(screen.getByTestId('portion-grams-input')).toHaveValue(100)

    fireEvent.click(screen.getByTestId('log-entry-button'))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))

    const entries = await new LogRepo(db).getEntriesForDate(todayISO())
    const logged = entries.find((e) => e.foodId === fixtureFood.id && e.meal === 'lunch')
    expect(logged).toMatchObject({ grams: 100, kcal: 100, unit: 'grams' })
  })
})
