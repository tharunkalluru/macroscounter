import { describe, expect, it } from 'vitest'
import { computeMealSuggestions, type SuggestionSourceEntry } from './suggestions'

const TODAY = '2026-08-18'

function idliSambar(date: string): SuggestionSourceEntry[] {
  return [
    { date, meal: 'breakfast', foodId: 'idli', name: 'Idli', qty: 3, unit: 'portion', grams: 120 },
    { date, meal: 'breakfast', foodId: 'sambar', name: 'Sambar', qty: 1, unit: 'portion', grams: 150 },
  ]
}

function dosa(date: string): SuggestionSourceEntry[] {
  return [{ date, meal: 'breakfast', foodId: 'dosa', name: 'Plain Dosa', qty: 1, unit: 'portion', grams: 90 }]
}

describe('computeMealSuggestions', () => {
  it('returns no chips for empty history', () => {
    expect(computeMealSuggestions([], 'breakfast', TODAY)).toEqual([])
  })

  it('surfaces the most-repeated combo as the top chip, with a natural-language label', () => {
    const history = [
      ...idliSambar('2026-08-10'),
      ...idliSambar('2026-08-12'),
      ...idliSambar('2026-08-14'),
      ...dosa('2026-08-11'),
    ]
    const chips = computeMealSuggestions(history, 'breakfast', TODAY)
    expect(chips[0].label).toBe('3 Idli + Sambar')
    expect(chips[0].entries).toHaveLength(2)
  })

  it('returns a second chip for the next-most-frequent distinct combo', () => {
    const history = [
      ...idliSambar('2026-08-10'),
      ...idliSambar('2026-08-12'),
      ...dosa('2026-08-11'),
      ...dosa('2026-08-13'),
      ...dosa('2026-08-15'),
    ]
    const chips = computeMealSuggestions(history, 'breakfast', TODAY)
    expect(chips).toHaveLength(2)
    // dosa recurred 3x vs idli+sambar's 2x, so it ranks first.
    expect(chips[0].label).toBe('Plain Dosa')
    expect(chips[1].label).toBe('3 Idli + Sambar')
  })

  it('caps chips at the requested limit (default 2) even with many distinct combos', () => {
    const history = [
      ...idliSambar('2026-08-10'),
      ...dosa('2026-08-11'),
      [{ date: '2026-08-12', meal: 'breakfast' as const, foodId: 'poha', name: 'Poha', qty: 1, unit: 'portion' as const, grams: 100 }],
    ].flat()
    const chips = computeMealSuggestions(history, 'breakfast', TODAY)
    expect(chips.length).toBeLessThanOrEqual(2)
  })

  it('breaks ties in frequency by most recent occurrence', () => {
    const history = [...idliSambar('2026-08-09'), ...dosa('2026-08-16')]
    const chips = computeMealSuggestions(history, 'breakfast', TODAY)
    // Both combos occurred exactly once; dosa is more recent, so it ranks first.
    expect(chips[0].label).toBe('Plain Dosa')
  })

  it('excludes entries outside the trailing window', () => {
    const history = [...idliSambar('2026-07-01')] // >14 days before TODAY
    expect(computeMealSuggestions(history, 'breakfast', TODAY)).toEqual([])
  })

  it('excludes entries logged today itself (the window looks at past days, not the live day)', () => {
    const history = [...idliSambar(TODAY)]
    expect(computeMealSuggestions(history, 'breakfast', TODAY)).toEqual([])
  })

  it('excludes entries for other meals', () => {
    const history: SuggestionSourceEntry[] = [
      { date: '2026-08-10', meal: 'lunch', foodId: 'idli', name: 'Idli', qty: 3, unit: 'portion', grams: 120 },
    ]
    expect(computeMealSuggestions(history, 'breakfast', TODAY)).toEqual([])
  })

  it('excludes entries without a foodId (custom/recipe entries are not replayable via a chip)', () => {
    const history: SuggestionSourceEntry[] = [
      { date: '2026-08-10', meal: 'breakfast', name: 'Restaurant meal', qty: 1, unit: 'grams', grams: 0 },
    ]
    expect(computeMealSuggestions(history, 'breakfast', TODAY)).toEqual([])
  })

  it('respects a custom window size', () => {
    const history = [...idliSambar('2026-08-05')] // 13 days before TODAY
    expect(computeMealSuggestions(history, 'breakfast', TODAY, 7)).toEqual([])
    expect(computeMealSuggestions(history, 'breakfast', TODAY, 14)).toHaveLength(1)
  })
})
