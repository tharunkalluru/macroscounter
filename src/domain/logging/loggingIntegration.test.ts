import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BitewiseDB } from '../../data/db'
import { LogRepo } from '../../data/repos/LogRepo'
import { sumMacros } from './portionMath'

let db: BitewiseDB
let logRepo: LogRepo

beforeEach(() => {
  db = new BitewiseDB(`test-logging-integration-${Math.random()}`)
  logRepo = new LogRepo(db)
})

afterEach(async () => {
  await db.delete()
})

describe('logging integration: log -> totals update -> edit qty -> totals update -> delete -> totals revert', () => {
  it('day totals move correctly through the full entry lifecycle', async () => {
    const today = '2026-08-18'

    const idliId = await logRepo.addEntry({
      date: today,
      meal: 'breakfast',
      foodId: 'idli',
      name: 'Idli',
      portionSummary: '2 x 1 idli',
      qty: 2,
      unit: 'portion',
      grams: 80,
      kcal: 82,
      p: 3.6,
      c: 16,
      f: 0.4,
    })
    const sambarId = await logRepo.addEntry({
      date: today,
      meal: 'breakfast',
      foodId: 'sambar',
      name: 'Sambar',
      portionSummary: '1 x 1 katori',
      qty: 1,
      unit: 'portion',
      grams: 150,
      kcal: 93,
      p: 4.5,
      c: 12,
      f: 3,
    })

    let entries = await logRepo.getEntriesForDate(today)
    expect(sumMacros(entries)).toEqual({ kcal: 175, p: 8.1, c: 28, f: 3.4 })

    // Edit idli qty 2 -> 3 (80g -> 120g)
    await logRepo.updateEntry(idliId, {
      qty: 3,
      grams: 120,
      kcal: 123,
      p: 5.4,
      c: 24,
      f: 0.6,
      portionSummary: '3 x 1 idli',
    })
    entries = await logRepo.getEntriesForDate(today)
    expect(sumMacros(entries)).toEqual({ kcal: 216, p: 9.9, c: 36, f: 3.6 })

    // Delete sambar -> totals revert to the updated idli entry alone
    await logRepo.deleteEntry(sambarId)
    entries = await logRepo.getEntriesForDate(today)
    expect(sumMacros(entries)).toEqual({ kcal: 123, p: 5.4, c: 24, f: 0.6 })

    // Delete idli too -> totals revert to zero
    await logRepo.deleteEntry(idliId)
    entries = await logRepo.getEntriesForDate(today)
    expect(sumMacros(entries)).toEqual({ kcal: 0, p: 0, c: 0, f: 0 })
  })
})
