import { describe, expect, it } from 'vitest'
import { computeWeeklyFocusTip } from './weeklyFocusTip'

describe('computeWeeklyFocusTip', () => {
  it('names the weekday with the biggest protein shortfall', () => {
    const days = [
      { weekday: 0, hitRate: 0.95 },
      { weekday: 1, hitRate: 0.9 },
      { weekday: 2, hitRate: 0.92 },
      { weekday: 3, hitRate: 0.88 },
      { weekday: 4, hitRate: 0.85 },
      { weekday: 5, hitRate: 0.4 }, // Saturday, well behind the rest
      { weekday: 6, hitRate: 0.5 },
    ]
    const tip = computeWeeklyFocusTip(days)
    expect(tip).toContain('Saturday')
  })

  it('returns null when every day is roughly the same', () => {
    const days = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, hitRate: 0.85 }))
    expect(computeWeeklyFocusTip(days)).toBeNull()
  })

  it('returns null for an empty week', () => {
    expect(computeWeeklyFocusTip([])).toBeNull()
  })
})
