import { describe, expect, it } from 'vitest'
import type { FoodRecord } from '../../data/models'
import { applyTemplate } from './applyTemplate'

const idli: FoodRecord = {
  id: 'idli',
  name: 'Idli',
  aliases: ['idly'],
  category: 'south-indian',
  per100g: { kcal: 102.5, p: 4.5, c: 20, f: 0.5, fiber: 0.9 },
  portions: [
    { label: '1 idli', grams: 40 },
    { label: '2 idli', grams: 80 },
  ],
  source: 'test',
  verified: true,
}

const sambar: FoodRecord = {
  id: 'sambar',
  name: 'Sambar',
  aliases: [],
  category: 'south-indian',
  per100g: { kcal: 62, p: 3, c: 8, f: 2, fiber: 2.2 },
  portions: [{ label: '1 katori', grams: 150 }],
  source: 'test',
  verified: true,
}

const foodsById = new Map([
  ['idli', idli],
  ['sambar', sambar],
])

describe('applyTemplate', () => {
  it('resolves a "3 idli + 1 katori sambar" template using each food\'s first portion', () => {
    const result = applyTemplate(
      [
        { foodId: 'idli', qty: 3, unit: 'portion' },
        { foodId: 'sambar', qty: 1, unit: 'portion' },
      ],
      foodsById
    )

    expect(result).toEqual([
      { foodId: 'idli', name: 'Idli', portionSummary: '3 x 1 idli', portionLabel: '1 idli', qty: 3, unit: 'portion', grams: 120, kcal: 123, p: 5.4, c: 24, f: 0.6 },
      { foodId: 'sambar', name: 'Sambar', portionSummary: '1 x 1 katori', portionLabel: '1 katori', qty: 1, unit: 'portion', grams: 150, kcal: 93, p: 4.5, c: 12, f: 3 },
    ])
  })

  it('resolves a gram-override entry directly', () => {
    const result = applyTemplate([{ foodId: 'idli', qty: 25, unit: 'grams' }], foodsById)
    expect(result).toEqual([
      { foodId: 'idli', name: 'Idli', portionSummary: '25 g', qty: 25, unit: 'grams', grams: 25, kcal: 25.6, p: 1.1, c: 5, f: 0.1 },
    ])
  })

  it('throws a clear error for a food id no longer in the database', () => {
    expect(() => applyTemplate([{ foodId: 'ghost', qty: 1, unit: 'portion' }], foodsById)).toThrow(
      /Unknown food id/
    )
  })
})
