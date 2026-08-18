import { describe, expect, it } from 'vitest'
import { addDaysISO, getMonthGrid, isFutureDate, todayISO } from './date'

describe('getMonthGrid', () => {
  it('February 2026 (28 days, starts on a Sunday) has no leading padding', () => {
    // 2026-02-01 is a Sunday.
    const grid = getMonthGrid(2026, 1)
    expect(grid[0]).toBe('2026-02-01')
    expect(grid).toHaveLength(28)
    expect(grid[grid.length - 1]).toBe('2026-02-28')
  })

  it('August 2026 starts on a Saturday, so has 6 leading nulls', () => {
    // 2026-08-01 is a Saturday.
    const grid = getMonthGrid(2026, 7)
    expect(grid.slice(0, 6)).toEqual([null, null, null, null, null, null])
    expect(grid[6]).toBe('2026-08-01')
    expect(grid[grid.length - 1]).toBe('2026-08-31')
  })

  it('handles a leap year February correctly', () => {
    const grid = getMonthGrid(2028, 1) // 2028 is a leap year
    const days = grid.filter((d): d is string => d !== null)
    expect(days).toHaveLength(29)
    expect(days[days.length - 1]).toBe('2028-02-29')
  })
})

describe('isFutureDate', () => {
  it('is false for today and past dates, true for future dates', () => {
    expect(isFutureDate(todayISO())).toBe(false)
    expect(isFutureDate(addDaysISO(todayISO(), -1))).toBe(false)
    expect(isFutureDate(addDaysISO(todayISO(), 1))).toBe(true)
  })
})

describe('addDaysISO', () => {
  it('adds and subtracts days, rolling over month/year boundaries', () => {
    expect(addDaysISO('2026-08-30', 3)).toBe('2026-09-02')
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31')
  })
})
