import { describe, expect, it } from 'vitest'
import { activeMealWindow } from './activeMealWindow'

function at(hours: number, minutes: number): Date {
  return new Date(2026, 0, 15, hours, minutes, 0)
}

describe('activeMealWindow', () => {
  it.each([
    // Overnight dead zone
    ['00:00', at(0, 0), null],
    ['02:30', at(2, 30), null],
    ['04:59', at(4, 59), null],
    // Breakfast: 5:00-10:59
    ['05:00 (breakfast opens)', at(5, 0), 'breakfast'],
    ['07:30', at(7, 30), 'breakfast'],
    ['10:59 (breakfast closes)', at(10, 59), 'breakfast'],
    // Lunch: 11:00-15:29
    ['11:00 (lunch opens)', at(11, 0), 'lunch'],
    ['13:00', at(13, 0), 'lunch'],
    ['15:29 (lunch closes)', at(15, 29), 'lunch'],
    // Snacks: 15:30-18:29
    ['15:30 (snacks opens)', at(15, 30), 'snacks'],
    ['17:00', at(17, 0), 'snacks'],
    ['18:29 (snacks closes)', at(18, 29), 'snacks'],
    // Dinner: 18:30-23:59
    ['18:30 (dinner opens)', at(18, 30), 'dinner'],
    ['21:00', at(21, 0), 'dinner'],
    ['23:59 (dinner closes)', at(23, 59), 'dinner'],
  ] as const)('%s -> %s', (_label, date, expected) => {
    expect(activeMealWindow(date)).toBe(expected)
  })
})
