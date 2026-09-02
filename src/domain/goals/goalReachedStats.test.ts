import { describe, expect, it } from 'vitest'
import { computeGoalReachedStats } from './goalReachedStats'

describe('computeGoalReachedStats', () => {
  it('computes lb lost, weekly average, and days-logged percentage over the full span', () => {
    const stats = computeGoalReachedStats({
      firstWeightKg: 90,
      latestWeightKg: 80,
      firstWeighInDate: '2026-01-01',
      latestWeighInDate: '2026-04-02', // ~91 days, ~13 weeks
      totalLoggedDays: 85,
    })
    expect(stats.lbLost).toBeCloseTo(22, 0) // (90-80)kg -> ~22 lb
    expect(stats.weeksElapsed).toBe(13)
    expect(stats.lbPerWeekAvg).toBeCloseTo(1.7, 1)
    expect(stats.daysLoggedPct).toBeLessThanOrEqual(100)
    expect(stats.daysLoggedPct).toBeGreaterThan(0)
  })

  it('never reports more than 100% days logged even with an odd span', () => {
    const stats = computeGoalReachedStats({
      firstWeightKg: 85,
      latestWeightKg: 80,
      firstWeighInDate: '2026-01-01',
      latestWeighInDate: '2026-01-02',
      totalLoggedDays: 50, // more logged days than the (tiny) span -- shouldn't happen, but must clamp
    })
    expect(stats.daysLoggedPct).toBe(100)
  })
})
