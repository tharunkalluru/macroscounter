import { describe, expect, it } from 'vitest'
import { computeHabitsWeek } from './habitsWeek'

describe('computeHabitsWeek', () => {
  const days = ['2026-08-25', '2026-08-26', '2026-08-27']

  it('marks weigh-in completion per day from the given date set', () => {
    const result = computeHabitsWeek(days, new Set(['2026-08-25', '2026-08-27']), new Map(), 100)
    expect(result.map((d) => d.loggedWeighIn)).toEqual([true, false, true])
  })

  it('computes protein hit-rate as a 0..1 fraction of the target', () => {
    const protein = new Map([
      ['2026-08-25', 50],
      ['2026-08-26', 100],
      ['2026-08-27', 150],
    ])
    const result = computeHabitsWeek(days, new Set(), protein, 100)
    expect(result.map((d) => d.proteinHitRate)).toEqual([0.5, 1, 1]) // 150/100 clamps to 1
  })

  it('is 0 for a day with no logged protein', () => {
    const result = computeHabitsWeek(days, new Set(), new Map(), 100)
    expect(result.every((d) => d.proteinHitRate === 0)).toBe(true)
  })

  it('is 0 across the board when there is no protein target', () => {
    const protein = new Map([['2026-08-25', 80]])
    const result = computeHabitsWeek(days, new Set(), protein, 0)
    expect(result.every((d) => d.proteinHitRate === 0)).toBe(true)
  })
})
