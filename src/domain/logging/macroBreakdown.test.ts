import { describe, expect, it } from 'vitest'
import { computeMacroBreakdown } from './macroBreakdown'

const entries = [
  { meal: 'breakfast' as const, p: 5.4, c: 24, f: 0.6 },
  { meal: 'breakfast' as const, p: 4.5, c: 12, f: 3 },
  { meal: 'lunch' as const, p: 20, c: 40, f: 10 },
  { meal: 'dinner' as const, p: 15, c: 5, f: 9 },
]

describe('computeMacroBreakdown', () => {
  it('sums the given macro per meal, in meal order, including empty meals', () => {
    const result = computeMacroBreakdown(entries, 'p')
    expect(result).toEqual([
      { meal: 'breakfast', grams: 9.9 },
      { meal: 'lunch', grams: 20 },
      { meal: 'snacks', grams: 0 },
      { meal: 'dinner', grams: 15 },
    ])
  })

  it('works for carbs and fat too', () => {
    expect(computeMacroBreakdown(entries, 'c').map((r) => r.grams)).toEqual([36, 40, 0, 5])
    expect(computeMacroBreakdown(entries, 'f').map((r) => r.grams)).toEqual([3.6, 10, 0, 9])
  })

  it('returns all-zero rows for no entries', () => {
    expect(computeMacroBreakdown([], 'p')).toEqual([
      { meal: 'breakfast', grams: 0 },
      { meal: 'lunch', grams: 0 },
      { meal: 'snacks', grams: 0 },
      { meal: 'dinner', grams: 0 },
    ])
  })
})
