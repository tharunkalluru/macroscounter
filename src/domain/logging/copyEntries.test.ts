import { describe, expect, it } from 'vitest'
import type { LogEntry } from '../../data/models'
import { buildCopiedEntries } from './copyEntries'

const source: LogEntry[] = [
  {
    id: 1,
    date: '2026-08-17',
    meal: 'breakfast',
    foodId: 'idli',
    name: 'Idli',
    portionSummary: '3 idli',
    portionLabel: '1 idli',
    qty: 3,
    unit: 'portion',
    grams: 120,
    kcal: 123,
    p: 5.4,
    c: 24,
    f: 0.6,
  },
  {
    id: 2,
    date: '2026-08-17',
    meal: 'breakfast',
    name: 'Restaurant meal',
    customSnapshot: { name: 'Restaurant meal', kcal: 400, p: 10, c: 50, f: 15 },
    portionSummary: 'custom',
    qty: 1,
    unit: 'grams',
    grams: 0,
    kcal: 400,
    p: 10,
    c: 50,
    f: 15,
  },
]

describe('buildCopiedEntries', () => {
  it('re-dates every entry to the target date', () => {
    const copied = buildCopiedEntries(source, '2026-08-18')
    expect(copied.every((e) => e.date === '2026-08-18')).toBe(true)
  })

  it('drops the source id so each copy becomes a fresh row', () => {
    const copied = buildCopiedEntries(source, '2026-08-18')
    expect(copied.every((e) => !('id' in e))).toBe(true)
  })

  it('preserves macro, portion, and food-linkage data unchanged', () => {
    const [copiedIdli] = buildCopiedEntries(source, '2026-08-18')
    expect(copiedIdli).toMatchObject({
      foodId: 'idli',
      name: 'Idli',
      portionSummary: '3 idli',
      portionLabel: '1 idli',
      qty: 3,
      grams: 120,
      kcal: 123,
    })
  })

  it('preserves custom-snapshot entries', () => {
    const [, copiedCustom] = buildCopiedEntries(source, '2026-08-18')
    expect(copiedCustom.customSnapshot).toEqual({ name: 'Restaurant meal', kcal: 400, p: 10, c: 50, f: 15 })
  })

  it('returns an empty array for an empty source', () => {
    expect(buildCopiedEntries([], '2026-08-18')).toEqual([])
  })

  it('does not mutate the source entries', () => {
    const clone = JSON.parse(JSON.stringify(source))
    buildCopiedEntries(source, '2026-08-18')
    expect(source).toEqual(clone)
  })
})
