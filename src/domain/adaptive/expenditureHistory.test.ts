import { describe, expect, it } from 'vitest'
import { addDaysISO } from '../../lib/date'
import { computeExpenditureHistory } from './expenditureHistory'
import type { DayKcal, WeighInPoint } from './adaptiveTargets'

const REFERENCE = '2026-08-29'

function buildDays(startOffsetDays: number, count: number, kcal: number): DayKcal[] {
  return Array.from({ length: count }, (_, i) => ({
    date: addDaysISO(REFERENCE, -startOffsetDays + i),
    kcal,
  }))
}

describe('computeExpenditureHistory', () => {
  it('returns one point per fully-covered week, oldest first', () => {
    // 42 days of logs (6 full weeks) ending today, weigh-ins every 3 days so
    // every 7-day window contains at least the 2 computeAdaptiveAdjustment needs.
    const loggedDays = buildDays(41, 42, 2000)
    const weighIns: WeighInPoint[] = Array.from({ length: 15 }, (_, i) => ({
      date: addDaysISO(REFERENCE, -41 + i * 3),
      weightKg: 80 - i * 0.1,
    }))

    const history = computeExpenditureHistory({ loggedDays, weighIns, referenceDate: REFERENCE, weeks: 6 })

    expect(history.length).toBeGreaterThan(0)
    expect(history.length).toBeLessThanOrEqual(6)
    // Oldest-first.
    for (let i = 1; i < history.length; i++) {
      expect(history[i].weekEndDate > history[i - 1].weekEndDate).toBe(true)
    }
  })

  it('omits weeks with insufficient data rather than throwing', () => {
    // Only 3 days of logs total -- no week has a full 7 days.
    const loggedDays = buildDays(2, 3, 2000)
    const weighIns: WeighInPoint[] = [
      { date: addDaysISO(REFERENCE, -2), weightKg: 80 },
      { date: REFERENCE, weightKg: 79.5 },
    ]

    const history = computeExpenditureHistory({ loggedDays, weighIns, referenceDate: REFERENCE, weeks: 6 })
    expect(history).toEqual([])
  })

  it('defaults to 6 weeks when not specified', () => {
    const loggedDays = buildDays(41, 42, 2000)
    const weighIns: WeighInPoint[] = Array.from({ length: 7 }, (_, i) => ({
      date: addDaysISO(REFERENCE, -41 + i * 7),
      weightKg: 80,
    }))
    const history = computeExpenditureHistory({ loggedDays, weighIns, referenceDate: REFERENCE })
    expect(history.length).toBeLessThanOrEqual(6)
  })
})
