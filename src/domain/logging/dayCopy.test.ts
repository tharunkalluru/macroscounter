import { describe, expect, it } from 'vitest'
import type { LogEntry } from '../../data/models'
import { shouldOfferDayCopy, summarizeDayCopy } from './dayCopy'

const entries: LogEntry[] = [
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
    kcal: 123.4,
    p: 5.4,
    c: 24,
    f: 0.6,
  },
  {
    id: 2,
    date: '2026-08-17',
    meal: 'lunch',
    foodId: 'rice',
    name: 'Rice',
    portionSummary: '200 g',
    qty: 200,
    unit: 'grams',
    grams: 200,
    kcal: 260.1,
    p: 5,
    c: 56,
    f: 0.5,
  },
]

describe('shouldOfferDayCopy', () => {
  it('offers the prompt when today is empty and yesterday has entries', () => {
    expect(shouldOfferDayCopy(0, entries)).toBe(true)
  })

  it('does not offer once anything has been logged today', () => {
    expect(shouldOfferDayCopy(1, entries)).toBe(false)
  })

  it('does not offer when yesterday itself is empty', () => {
    expect(shouldOfferDayCopy(0, [])).toBe(false)
  })
})

describe('summarizeDayCopy', () => {
  it('counts items and sums rounded kcal', () => {
    expect(summarizeDayCopy(entries)).toEqual({ count: 2, kcal: 384 })
  })

  it('returns a zeroed summary for no entries', () => {
    expect(summarizeDayCopy([])).toEqual({ count: 0, kcal: 0 })
  })
})
