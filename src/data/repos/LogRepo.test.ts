import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BitewiseDB } from '../db'
import type { LogEntry } from '../models'
import { EntryPhotoRepo } from './EntryPhotoRepo'
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

  it('deleting an entry also removes its attached photo, leaving nothing orphaned', async () => {
    const id = await repo.addEntry(sampleEntry())
    await new EntryPhotoRepo(db).attach(id, new Blob(['x'], { type: 'image/jpeg' }), 'image/jpeg')

    await repo.deleteEntry(id)

    expect(await new EntryPhotoRepo(db).getForEntry(id)).toBeUndefined()
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

describe('LogRepo indexes logged items for reuse via search', () => {
  it('indexes a barcode entry (no foodId) as a searchable food record', async () => {
    await repo.addEntry(
      sampleEntry({ foodId: undefined, barcode: '8901491101615', name: 'Maggi Noodles', grams: 70, kcal: 300 })
    )
    const food = await db.foods.get('logged-maggi-noodles')
    expect(food?.name).toBe('Maggi Noodles')
    expect(food?.source).toBe('logged')
  })

  it('does not index an entry that already references a real food', async () => {
    await repo.addEntry(sampleEntry({ foodId: 'idli', name: 'Idli' }))
    expect(await db.foods.get('logged-idli')).toBeUndefined()
  })

  it('does not index a fixed-value quick-add entry (grams: 0)', async () => {
    await repo.addEntry(sampleEntry({ foodId: undefined, name: 'Restaurant meal', grams: 0 }))
    expect(await db.foods.get('logged-restaurant-meal')).toBeUndefined()
  })

  it('relogging the same name updates the one record instead of duplicating it, keeping favorite status', async () => {
    await repo.addEntry(sampleEntry({ foodId: undefined, name: 'Paneer Tikka', grams: 100, kcal: 200 }))
    await db.foods.update('logged-paneer-tikka', { favorite: true })

    await repo.addEntry(sampleEntry({ foodId: undefined, name: 'Paneer Tikka', grams: 100, kcal: 220 }))

    expect(await db.foods.count()).toBe(1)
    const food = await db.foods.get('logged-paneer-tikka')
    expect(food?.per100g.kcal).toBe(220)
    expect(food?.favorite).toBe(true)
  })
})

describe('LogRepo atomic saves', () => {
  it('rolls back a partially written meal when a later row fails', async () => {
    const { vi } = await import('vitest')
    const original = db.logEntries.add.bind(db.logEntries)
    let writes = 0
    const add = vi.spyOn(db.logEntries, 'add').mockImplementation((...args) => {
      writes++
      if (writes === 2) throw new Error('Storage is full')
      return original(...args)
    })
    try {
      await expect(repo.addEntries([sampleEntry(), sampleEntry({ name: 'Sambar' })])).rejects.toThrow('Storage is full')
      expect(await db.logEntries.count()).toBe(0)
    } finally { add.mockRestore() }
  })

  it('rolls back both the visible edit and queue if tracking fails', async () => {
    const { vi } = await import('vitest')
    await db.syncMeta.add({ userId: 'user-a' } as never)
    const id = await repo.addEntry(sampleEntry())
    const before = await repo.getById(id)
    const queueBefore = await db.syncOutbox.toArray()
    const put = vi.spyOn(db.syncOutbox, 'put').mockImplementation(() => { throw new Error('Storage is full') })
    try {
      await expect(repo.updateEntry(id, { name: 'New name' })).rejects.toThrow('Storage is full')
      expect(await repo.getById(id)).toEqual(before)
      expect(await db.syncOutbox.toArray()).toEqual(queueBefore)
    } finally { put.mockRestore() }
  })
})
