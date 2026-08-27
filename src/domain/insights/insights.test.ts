import { describe, expect, it } from 'vitest'
import {
  computeInsights,
  computeMacroBalanceInsight,
  computeTopMealInsight,
  computeWeekendVsWeekdayInsight,
} from './insights'

describe('computeWeekendVsWeekdayInsight', () => {
  it('flags a meaningfully heavier weekend', () => {
    // 2026-08-10 is a Monday; 15/16 are Sat/Sun
    const days = [
      { date: '2026-08-10', kcal: 1800 },
      { date: '2026-08-11', kcal: 1800 },
      { date: '2026-08-12', kcal: 1800 },
      { date: '2026-08-15', kcal: 2400 },
      { date: '2026-08-16', kcal: 2400 },
    ]
    const insight = computeWeekendVsWeekdayInsight(days)
    expect(insight?.id).toBe('weekend-vs-weekday')
    expect(insight?.text).toContain('weekends')
    expect(insight?.text).toContain('33%')
  })

  it('returns null when there are too few weekday or weekend days', () => {
    const days = [
      { date: '2026-08-10', kcal: 1800 },
      { date: '2026-08-15', kcal: 2400 },
    ]
    expect(computeWeekendVsWeekdayInsight(days)).toBeNull()
  })

  it('returns null when the gap is too small to be a real pattern', () => {
    const days = [
      { date: '2026-08-10', kcal: 2000 },
      { date: '2026-08-11', kcal: 2000 },
      { date: '2026-08-12', kcal: 2000 },
      { date: '2026-08-15', kcal: 2050 },
      { date: '2026-08-16', kcal: 2050 },
    ]
    expect(computeWeekendVsWeekdayInsight(days)).toBeNull()
  })
})

describe('computeTopMealInsight', () => {
  it('names the meal that dominates average daily calories', () => {
    const entries = [
      { meal: 'dinner' as const, kcal: 900 },
      { meal: 'dinner' as const, kcal: 900 },
      { meal: 'breakfast' as const, kcal: 400 },
      { meal: 'lunch' as const, kcal: 300 },
    ]
    const insight = computeTopMealInsight(entries)
    expect(insight?.id).toBe('top-meal')
    expect(insight?.text).toContain('Dinner')
  })

  it('returns null when no meal is dominant', () => {
    const entries = [
      { meal: 'breakfast' as const, kcal: 500 },
      { meal: 'lunch' as const, kcal: 500 },
      { meal: 'snacks' as const, kcal: 500 },
      { meal: 'dinner' as const, kcal: 500 },
    ]
    expect(computeTopMealInsight(entries)).toBeNull()
  })

  it('returns null for an empty log', () => {
    expect(computeTopMealInsight([])).toBeNull()
  })
})

describe('computeMacroBalanceInsight', () => {
  const target = { proteinG: 150, carbsG: 200, fatG: 60 }

  it('flags the macro furthest from target', () => {
    const days = [
      { p: 100, c: 200, f: 60 },
      { p: 105, c: 200, f: 60 },
      { p: 95, c: 200, f: 60 },
      { p: 100, c: 200, f: 60 },
    ]
    const insight = computeMacroBalanceInsight(days, target)
    expect(insight?.id).toBe('macro-balance')
    expect(insight?.text).toContain('protein')
    expect(insight?.text).toContain('under')
  })

  it('returns null when everything is close to target', () => {
    const days = [
      { p: 145, c: 195, f: 58 },
      { p: 150, c: 205, f: 62 },
      { p: 155, c: 200, f: 60 },
      { p: 148, c: 198, f: 59 },
    ]
    expect(computeMacroBalanceInsight(days, target)).toBeNull()
  })

  it('returns null with fewer than 4 days', () => {
    const days = [
      { p: 50, c: 200, f: 60 },
      { p: 50, c: 200, f: 60 },
    ]
    expect(computeMacroBalanceInsight(days, target)).toBeNull()
  })
})

describe('computeInsights', () => {
  it('combines only the insights that clear their thresholds', () => {
    const days = [
      { date: '2026-08-10', kcal: 2000, p: 145, c: 200, f: 58 },
      { date: '2026-08-11', kcal: 2000, p: 150, c: 205, f: 62 },
      { date: '2026-08-12', kcal: 2000, p: 155, c: 200, f: 60 },
    ]
    const target = { proteinG: 150, carbsG: 200, fatG: 60 }
    expect(computeInsights(days, [], target)).toEqual([])
  })
})
