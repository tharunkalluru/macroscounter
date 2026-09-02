import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BitewiseDB } from '../../data/db'
import { LogRepo } from '../../data/repos/LogRepo'
import { WeighInRepo } from '../../data/repos/WeighInRepo'
import { groupEntriesByDate } from '../history/averages'
import { computeAdaptiveAdjustment } from './adaptiveTargets'

let db: BitewiseDB
let logRepo: LogRepo
let weighInRepo: WeighInRepo

beforeEach(() => {
  db = new BitewiseDB(`test-adaptive-integration-${Math.random()}`)
  logRepo = new LogRepo(db)
  weighInRepo = new WeighInRepo(db)
})

afterEach(async () => {
  await db.delete()
})

function dateRange(start: string, count: number): string[] {
  const [y, m, d] = start.split('-').map(Number)
  const dates: string[] = []
  for (let i = 0; i < count; i++) {
    const date = new Date(y, m - 1, d + i)
    dates.push(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    )
  }
  return dates
}

describe('adaptive targets integration: 3-week seeded dataset produces the exact expected sequence', () => {
  it('week 1 raises (losing too fast), week 2 lowers (plateau), week 3 holds (on track)', async () => {
    let entryId = 0
    async function logWeek(dates: string[], kcal: number) {
      for (const date of dates) {
        await logRepo.addEntry({
          date,
          meal: 'lunch',
          name: `Entry ${entryId++}`,
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
    }

    const week1Dates = dateRange('2026-07-29', 7) // ends 2026-08-04
    const week2Dates = dateRange('2026-08-05', 7) // ends 2026-08-11
    const week3Dates = dateRange('2026-08-12', 7) // ends 2026-08-18

    await logWeek(week1Dates, 1628)
    await logWeek(week2Dates, 1728)
    await logWeek(week3Dates, 1628)

    await weighInRepo.add({ date: '2026-07-29', weightKg: 80.0 })
    await weighInRepo.add({ date: '2026-08-04', weightKg: 79.0 }) // week 1: -1.0kg -> too fast
    await weighInRepo.add({ date: '2026-08-05', weightKg: 79.0 })
    await weighInRepo.add({ date: '2026-08-11', weightKg: 79.0 }) // week 2: 0kg -> plateau
    await weighInRepo.add({ date: '2026-08-12', weightKg: 79.0 })
    await weighInRepo.add({ date: '2026-08-18', weightKg: 78.5 }) // week 3: -0.5kg -> on track

    const floorKcal = 1200

    async function runWeek(referenceDate: string, windowStart: string, currentTargetKcal: number) {
      const entries = await logRepo.getEntriesForDateRange(windowStart, referenceDate)
      const weighIns = await weighInRepo.getInRange(windowStart, referenceDate)
      return computeAdaptiveAdjustment({
        loggedDays: groupEntriesByDate(entries),
        weighIns: weighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })),
        currentTargetKcal,
        floorKcal,
        referenceDate,
      })
    }

    const week1 = await runWeek('2026-08-04', '2026-07-29', 1628)
    expect(week1?.adjustment).toBe(100)
    expect(week1?.suggestedKcal).toBe(1728)

    const week2 = await runWeek('2026-08-11', '2026-08-05', week1!.suggestedKcal)
    expect(week2?.adjustment).toBe(-100)
    expect(week2?.suggestedKcal).toBe(1628)

    const week3 = await runWeek('2026-08-18', '2026-08-12', week2!.suggestedKcal)
    expect(week3?.adjustment).toBe(0)
    expect(week3?.suggestedKcal).toBe(1628)

    // The exact expected recommendation sequence.
    expect([week1?.suggestedKcal, week2?.suggestedKcal, week3?.suggestedKcal]).toEqual([1728, 1628, 1628])
  })
})
