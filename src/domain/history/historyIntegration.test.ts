import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MacroDesiDB } from '../../data/db'
import { LogRepo } from '../../data/repos/LogRepo'
import { TargetRepo } from '../../data/repos/TargetRepo'
import { computeAverage, groupEntriesByDate } from './averages'
import { classifyDay } from './colorBand'
import { findApplicableTarget } from './targetForDate'

let db: MacroDesiDB
let logRepo: LogRepo
let targetRepo: TargetRepo

beforeEach(() => {
  db = new MacroDesiDB(`test-history-integration-${Math.random()}`)
  logRepo = new LogRepo(db)
  targetRepo = new TargetRepo(db)
})

afterEach(async () => {
  await db.delete()
})

// 9 of 10 calendar days (2026-08-09 .. 2026-08-18) get a single entry each;
// 2026-08-14 is deliberately left unlogged to exercise "skip, don't zero-fill".
const DAY_KCAL: Record<string, number> = {
  '2026-08-09': 1800, // green
  '2026-08-10': 2000, // green (exactly at target)
  '2026-08-11': 2100, // amber
  '2026-08-12': 2200, // amber (exactly 110%)
  '2026-08-13': 2300, // red
  // '2026-08-14': not logged -> none
  '2026-08-15': 1900, // green
  '2026-08-16': 2500, // red
  '2026-08-17': 2050, // amber
  '2026-08-18': 1700, // green
}

const EXPECTED_BANDS: Record<string, string> = {
  '2026-08-09': 'green',
  '2026-08-10': 'green',
  '2026-08-11': 'amber',
  '2026-08-12': 'amber',
  '2026-08-13': 'red',
  '2026-08-14': 'none',
  '2026-08-15': 'green',
  '2026-08-16': 'red',
  '2026-08-17': 'amber',
  '2026-08-18': 'green',
}

describe('history integration: 10-day seeded calendar + averages', () => {
  beforeEach(async () => {
    await targetRepo.add({
      effectiveDate: '2026-08-01',
      kcal: 2000,
      proteinG: 150,
      carbsG: 200,
      fatG: 60,
      source: 'computed',
    })
    let i = 0
    for (const [date, kcal] of Object.entries(DAY_KCAL)) {
      await logRepo.addEntry({
        date,
        meal: 'lunch',
        name: `Test entry ${i++}`,
        portionSummary: '1 serving',
        qty: 1,
        unit: 'portion',
        grams: 100,
        kcal,
        p: 0,
        c: 0,
        f: 0,
      })
    }
  })

  it('renders the correct color band for every day in the range, including the unlogged day', async () => {
    const entries = await logRepo.getEntriesForDateRange('2026-08-09', '2026-08-18')
    const dayTotals = groupEntriesByDate(entries)
    const byDate = new Map(dayTotals.map((d) => [d.date, d]))
    const targets = await targetRepo.getAll()

    for (const date of Object.keys(EXPECTED_BANDS)) {
      const total = byDate.get(date)
      const target = findApplicableTarget(date, targets)
      expect(classifyDay(total?.kcal, target?.kcal), date).toBe(EXPECTED_BANDS[date])
    }
  })

  it('7-day average (08-12..08-18) skips the unlogged day and matches the fixture', async () => {
    const entries = await logRepo.getEntriesForDateRange('2026-08-12', '2026-08-18')
    const dayTotals = groupEntriesByDate(entries)
    const avg = computeAverage(dayTotals)

    expect(avg.daysCounted).toBe(6) // 7 calendar days, 1 unlogged
    expect(avg.kcal).toBe(2108.3)
  })

  it('30-day average (whole 10-day seed window) matches the fixture', async () => {
    const entries = await logRepo.getEntriesForDateRange('2026-07-19', '2026-08-18')
    const dayTotals = groupEntriesByDate(entries)
    const avg = computeAverage(dayTotals)

    expect(avg.daysCounted).toBe(9)
    expect(avg.kcal).toBe(2061.1)
  })
})
