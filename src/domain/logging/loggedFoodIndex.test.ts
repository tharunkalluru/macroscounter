import { describe, expect, it } from 'vitest'
import type { LogEntry } from '../../data/models'
import { deriveLoggedFoodRecord, loggedFoodId } from './loggedFoodIndex'

const baseEntry: Pick<
  LogEntry,
  'foodId' | 'recipeId' | 'grams' | 'name' | 'kcal' | 'p' | 'c' | 'f' | 'fiber' | 'portionLabel' | 'portionSummary'
> = {
  foodId: undefined,
  recipeId: undefined,
  grams: 150,
  name: 'Grilled Chicken Breast',
  kcal: 240,
  p: 45,
  c: 0,
  f: 6,
  fiber: 0,
  portionLabel: undefined,
  portionSummary: '150 g',
}

describe('loggedFoodId', () => {
  it('slugifies a name into a stable, dedup-friendly id', () => {
    expect(loggedFoodId('Grilled Chicken Breast')).toBe('logged-grilled-chicken-breast')
    expect(loggedFoodId('  Idli  (2x) ')).toBe('logged-idli-2x')
  })
})

describe('deriveLoggedFoodRecord', () => {
  it('scales a barcode/AI/manual entry to a reusable per-100g food record', () => {
    const record = deriveLoggedFoodRecord(baseEntry)
    expect(record).not.toBeNull()
    expect(record?.id).toBe('logged-grilled-chicken-breast')
    expect(record?.per100g).toEqual({ kcal: 160, p: 30, c: 0, f: 4, fiber: 0 })
    expect(record?.portions).toEqual([{ label: '150 g', grams: 150 }])
    expect(record?.source).toBe('logged')
    expect(record?.verified).toBe(false)
  })

  it('prefers the portion label over the raw summary when both exist', () => {
    const record = deriveLoggedFoodRecord({ ...baseEntry, portionLabel: '1 bowl', portionSummary: '150 g' })
    expect(record?.portions).toEqual([{ label: '1 bowl', grams: 150 }])
  })

  it('returns null for an entry that already references a real food', () => {
    expect(deriveLoggedFoodRecord({ ...baseEntry, foodId: 'chicken-breast' })).toBeNull()
  })

  it('returns null for an entry that already references a recipe', () => {
    expect(deriveLoggedFoodRecord({ ...baseEntry, recipeId: 1 })).toBeNull()
  })

  it('returns null for a fixed-value entry with no gram basis (quick-add)', () => {
    expect(deriveLoggedFoodRecord({ ...baseEntry, grams: 0 })).toBeNull()
  })

  it('returns null for a blank name', () => {
    expect(deriveLoggedFoodRecord({ ...baseEntry, name: '   ' })).toBeNull()
  })
})
