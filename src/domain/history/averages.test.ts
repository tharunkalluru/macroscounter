import { describe, expect, it } from 'vitest'
import { computeAverage, groupEntriesByDate } from './averages'

describe('computeAverage', () => {
  it('averages only over provided (logged) days — missing days are skipped, not zero-filled', () => {
    // Only 2 of a possible 7-day window have entries.
    const days = [
      { date: '2026-08-10', kcal: 2000, p: 150, c: 200, f: 60 },
      { date: '2026-08-12', kcal: 1800, p: 140, c: 180, f: 55 },
    ]
    const result = computeAverage(days)
    // (2000+1800)/2 = 1900, NOT (2000+1800)/7 = 542.9
    expect(result.kcal).toBe(1900)
    expect(result.p).toBe(145)
    expect(result.daysCounted).toBe(2)
  })

  it('returns zeros with daysCounted 0 for an empty window', () => {
    expect(computeAverage([])).toEqual({ kcal: 0, p: 0, c: 0, f: 0, daysCounted: 0 })
  })
})

describe('groupEntriesByDate', () => {
  it('sums multiple entries on the same day and keeps days sorted', () => {
    const entries = [
      { date: '2026-08-12', kcal: 500, p: 30, c: 50, f: 15 },
      { date: '2026-08-10', kcal: 82, p: 3.6, c: 16, f: 0.4 },
      { date: '2026-08-10', kcal: 93, p: 4.5, c: 12, f: 3 },
    ]
    const result = groupEntriesByDate(entries)
    expect(result).toEqual([
      { date: '2026-08-10', kcal: 175, p: 8.1, c: 28, f: 3.4 },
      { date: '2026-08-12', kcal: 500, p: 30, c: 50, f: 15 },
    ])
  })

  it('returns an empty array for no entries', () => {
    expect(groupEntriesByDate([])).toEqual([])
  })
})
