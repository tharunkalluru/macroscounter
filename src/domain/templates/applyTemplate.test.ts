import { describe, expect, it } from 'vitest'
import type { FoodRecord, LogEntry } from '../../data/models'
import { applyTemplate, buildTemplateEntries } from './applyTemplate'

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
      { foodId: 'idli', name: 'Idli', portionSummary: '3 x 1 idli', portionLabel: '1 idli', qty: 3, unit: 'portion', grams: 120, kcal: 123, p: 5.4, c: 24, f: 0.6, fiber: 1.1 },
      { foodId: 'sambar', name: 'Sambar', portionSummary: '1 x 1 katori', portionLabel: '1 katori', qty: 1, unit: 'portion', grams: 150, kcal: 93, p: 4.5, c: 12, f: 3, fiber: 3.3 },
    ])
  })

  it('resolves a gram-override entry directly', () => {
    const result = applyTemplate([{ foodId: 'idli', qty: 25, unit: 'grams' }], foodsById)
    expect(result).toEqual([
      { foodId: 'idli', name: 'Idli', portionSummary: '25 g', qty: 25, unit: 'grams', grams: 25, kcal: 25.6, p: 1.1, c: 5, f: 0.1, fiber: 0.2 },
    ])
  })

  it('throws a clear error for a food id no longer in the database', () => {
    expect(() => applyTemplate([{ foodId: 'ghost', qty: 1, unit: 'portion' }], foodsById)).toThrow(
      /Unknown food id/
    )
  })

  it('preserves a complete mixed meal and alternate serving even without its original foods or recipes', () => {
    const base: LogEntry = { id: 1, clientId: 'original', updatedAt: 123, date: '2026-08-17', meal: 'lunch', name: 'Idli', foodId: 'idli', portionSummary: '2 x 2 idli', portionLabel: '2 idli', qty: 2, unit: 'portion', grams: 160, kcal: 164, p: 7.2, c: 32, f: 0.8, fiber: 1.4, loggedAt: '2026-08-17T12:00:00Z' }
    const source: LogEntry[] = [
      base,
      { ...base, id: 2, foodId: undefined, recipeId: 5, name: 'Homemade curry' },
      { ...base, id: 3, foodId: undefined, barcode: '1234567890123', name: 'Yogurt' },
      { ...base, id: 4, foodId: undefined, name: 'Restaurant meal', grams: 0, customSnapshot: { name: 'Restaurant meal', kcal: 164, p: 7.2, c: 32, f: 0.8, fiber: 1.4 } },
    ]
    const saved = buildTemplateEntries(source)
    const resolved = applyTemplate(saved, new Map())
    expect(resolved).toHaveLength(4)
    expect(resolved.map((e) => e.name)).toEqual(source.map((e) => e.name))
    expect(resolved[0]).toMatchObject({ qty: 2, grams: 160, kcal: 164, fiber: 1.4, portionLabel: '2 idli' })
    for (const entry of resolved) {
      for (const field of ['id', 'clientId', 'date', 'meal', 'updatedAt', 'deletedAt', 'loggedAt', 'recipeId']) {
        expect(entry).not.toHaveProperty(field)
      }
    }
    expect(resolved[3].customSnapshot).toEqual(source[3].customSnapshot)
    expect(resolved[3].customSnapshot).not.toBe(source[3].customSnapshot)
  })
})
