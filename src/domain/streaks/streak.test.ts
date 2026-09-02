import { describe, expect, it } from 'vitest'
import { computeBestStreak, computeConsistency, computeStreak, computeStreakStartDate, getStreakMilestone } from './streak'

describe('computeBestStreak', () => {
  it('returns 0 for no logged dates', () => {
    expect(computeBestStreak([])).toBe(0)
  })

  it('returns the run length for a single unbroken streak', () => {
    expect(computeBestStreak(['2026-01-01', '2026-01-02', '2026-01-03'])).toBe(3)
  })

  it('finds the longest of several runs, even one that already ended', () => {
    // A 5-day run in January, then a shorter 2-day run more recently.
    const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-03-01', '2026-03-02']
    expect(computeBestStreak(dates)).toBe(5)
  })

  it('is unaffected by duplicate or unsorted input', () => {
    expect(computeBestStreak(['2026-01-03', '2026-01-01', '2026-01-02', '2026-01-02'])).toBe(3)
  })

  it('a single logged day is a streak of 1', () => {
    expect(computeBestStreak(['2026-01-01'])).toBe(1)
  })
})

describe('computeStreak', () => {
  it('counts consecutive days ending today when today is logged', () => {
    const days = ['2026-08-16', '2026-08-17', '2026-08-18']
    expect(computeStreak(days, '2026-08-18')).toBe(3)
  })

  it('a gap breaks the streak — only counts back to the gap', () => {
    // 08-15 logged, 08-16 missing (gap), 08-17 + 08-18 logged.
    const days = ['2026-08-15', '2026-08-17', '2026-08-18']
    expect(computeStreak(days, '2026-08-18')).toBe(2)
  })

  it("counts from yesterday when today isn't logged yet (day still in progress)", () => {
    const days = ['2026-08-16', '2026-08-17']
    expect(computeStreak(days, '2026-08-18')).toBe(2)
  })

  it('returns 0 when neither today nor yesterday is logged', () => {
    const days = ['2026-08-10']
    expect(computeStreak(days, '2026-08-18')).toBe(0)
  })

  it('returns 0 for an empty log', () => {
    expect(computeStreak([], '2026-08-18')).toBe(0)
  })

  it('is timezone/month-boundary safe: streak spanning Aug 31 -> Sep 1', () => {
    const days = ['2026-08-30', '2026-08-31', '2026-09-01']
    expect(computeStreak(days, '2026-09-01')).toBe(3)
  })

  it('is year-boundary safe: streak spanning Dec 31 -> Jan 1', () => {
    const days = ['2025-12-30', '2025-12-31', '2026-01-01']
    expect(computeStreak(days, '2026-01-01')).toBe(3)
  })
})

describe('computeConsistency', () => {
  it('computes the fraction of the last N days that were logged', () => {
    const days = ['2026-08-16', '2026-08-17', '2026-08-18']
    expect(computeConsistency(days, '2026-08-18', 30)).toBeCloseTo(3 / 30, 10)
  })

  it('ignores entries outside the window', () => {
    const days = ['2026-06-01', '2026-08-18'] // 2026-06-01 is well outside a 30-day window
    expect(computeConsistency(days, '2026-08-18', 30)).toBeCloseTo(1 / 30, 10)
  })

  it('returns 1 when every day in the window was logged', () => {
    const days: string[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 7, 18 - i)
      days.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      )
    }
    expect(computeConsistency(days, '2026-08-18', 30)).toBe(1)
  })

  it('returns 0 for an empty log', () => {
    expect(computeConsistency([], '2026-08-18', 30)).toBe(0)
  })
})

describe('getStreakMilestone', () => {
  it.each([3, 7, 14, 30, 50, 75, 100])('flags the fixed early milestone %i', (n) => {
    expect(getStreakMilestone(n)).toBe(n)
  })

  it.each([150, 200, 350])('flags every 50 days past 100', (n) => {
    expect(getStreakMilestone(n)).toBe(n)
  })

  it.each([0, 1, 2, 4, 8, 15, 29, 101, 120])('is null for a non-milestone streak', (n) => {
    expect(getStreakMilestone(n)).toBeNull()
  })
})

describe('computeStreakStartDate', () => {
  it('returns null when streak is 0', () => {
    expect(computeStreakStartDate([], '2026-08-18', 0)).toBeNull()
  })

  it('walks back from today when today is logged', () => {
    const days = ['2026-08-16', '2026-08-17', '2026-08-18']
    expect(computeStreakStartDate(days, '2026-08-18', 3)).toBe('2026-08-16')
  })

  it("walks back from yesterday when today isn't logged yet", () => {
    const days = ['2026-08-16', '2026-08-17']
    expect(computeStreakStartDate(days, '2026-08-18', 2)).toBe('2026-08-16')
  })

  it('is month-boundary safe', () => {
    const days = ['2026-08-30', '2026-08-31', '2026-09-01']
    expect(computeStreakStartDate(days, '2026-09-01', 3)).toBe('2026-08-30')
  })
})
