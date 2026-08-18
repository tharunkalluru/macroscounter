import { describe, expect, it } from 'vitest'
import { computeWeeklyReport } from './weeklyReport'

const target = { kcal: 2000, proteinG: 150 }

describe('computeWeeklyReport', () => {
  it('computes avg kcal, protein hit-rate, and best/worst day from a fixture week', () => {
    const days = [
      { date: '2026-08-12', kcal: 2000, p: 160 }, // on target, protein hit -> deviation 0 (best)
      { date: '2026-08-13', kcal: 1800, p: 140 }, // deviation 200, protein miss
      { date: '2026-08-14', kcal: 2500, p: 155 }, // deviation 500 (worst), protein hit
      { date: '2026-08-15', kcal: 2100, p: 150 }, // deviation 100, protein hit (exactly at target)
      { date: '2026-08-16', kcal: 1900, p: 130 }, // deviation 100, protein miss
    ]
    const report = computeWeeklyReport(days, target)

    expect(report.daysCounted).toBe(5)
    expect(report.avgKcal).toBe(2060) // (2000+1800+2500+2100+1900)/5
    expect(report.proteinHitRate).toBe(0.6) // 3 of 5 days >= 150g
    expect(report.bestDay).toEqual({ date: '2026-08-12', kcal: 2000 })
    expect(report.worstDay).toEqual({ date: '2026-08-14', kcal: 2500 })
  })

  it('handles an empty window without dividing by zero', () => {
    expect(computeWeeklyReport([], target)).toEqual({
      avgKcal: 0,
      proteinHitRate: 0,
      bestDay: null,
      worstDay: null,
      daysCounted: 0,
    })
  })

  it('handles a single-day window', () => {
    const report = computeWeeklyReport([{ date: '2026-08-18', kcal: 1900, p: 120 }], target)
    expect(report.avgKcal).toBe(1900)
    expect(report.proteinHitRate).toBe(0)
    expect(report.bestDay).toEqual({ date: '2026-08-18', kcal: 1900 })
    expect(report.worstDay).toEqual({ date: '2026-08-18', kcal: 1900 })
  })
})
