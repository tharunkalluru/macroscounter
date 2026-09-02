import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BitewiseDB } from '../db'
import type { LogEntry } from '../models'
import { LogRepo } from './LogRepo'

const sampleEntry = (overrides: Partial<LogEntry> = {}): Omit<LogEntry, 'id'> => ({
  date: '2026-08-18',
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
  ...overrides,
})

let db: BitewiseDB
let repo: LogRepo

beforeEach(() => {
  db = new BitewiseDB(`test-log-${Math.random()}`)
  repo = new LogRepo(db)
})

afterEach(async () => {
  await db.delete()
})

describe('LogRepo', () => {
  it('adds an entry and reads it back by id', async () => {
    const id = await repo.addEntry(sampleEntry())
    const found = await repo.getById(id)
    expect(found?.foodId).toBe('idli')
    expect(found?.kcal).toBe(82)
  })

  it('round-trips: add -> update -> delete', async () => {
    const id = await repo.addEntry(sampleEntry())

    await repo.updateEntry(id, { qty: 3, grams: 120, kcal: 123 })
    const updated = await repo.getById(id)
    expect(updated?.qty).toBe(3)
    expect(updated?.kcal).toBe(123)

    await repo.deleteEntry(id)
    expect(await repo.getById(id)).toBeUndefined()
  })

  it('fetches entries for a specific date', async () => {
    await repo.addEntry(sampleEntry({ date: '2026-08-18' }))
    await repo.addEntry(sampleEntry({ date: '2026-08-19' }))

    const entries = await repo.getEntriesForDate('2026-08-18')
    expect(entries).toHaveLength(1)
    expect(entries[0].date).toBe('2026-08-18')
  })

  it('fetches entries for a date range', async () => {
    await repo.addEntry(sampleEntry({ date: '2026-08-16' }))
    await repo.addEntry(sampleEntry({ date: '2026-08-18' }))
    await repo.addEntry(sampleEntry({ date: '2026-08-20' }))

    const entries = await repo.getEntriesForDateRange('2026-08-17', '2026-08-19')
    expect(entries).toHaveLength(1)
    expect(entries[0].date).toBe('2026-08-18')
  })

  it('returns distinct recent food ids, most recent first', async () => {
    await repo.addEntry(sampleEntry({ date: '2026-08-16', foodId: 'idli' }))
    await repo.addEntry(sampleEntry({ date: '2026-08-17', foodId: 'dosa' }))
    await repo.addEntry(sampleEntry({ date: '2026-08-18', foodId: 'idli' }))

    const recent = await repo.getRecentFoodIds(10)
    expect(recent).toEqual(['idli', 'dosa'])
  })

  it('returns distinct recent barcodes, most recent first', async () => {
    await repo.addEntry(
      sampleEntry({ date: '2026-08-16', foodId: undefined, barcode: '8901491101615' })
    )
    await repo.addEntry(
      sampleEntry({ date: '2026-08-17', foodId: undefined, barcode: '8901063114074' })
    )
    await repo.addEntry(
      sampleEntry({ date: '2026-08-18', foodId: undefined, barcode: '8901491101615' })
    )

    const recent = await repo.getRecentBarcodes(10)
    expect(recent).toEqual(['8901491101615', '8901063114074'])
  })
})
