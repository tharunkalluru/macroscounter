import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LogRepo } from '../../data/repos/LogRepo'
import { BitewiseDB } from '../../data/db'
import type { LogEntry } from '../../data/models'

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
  db = new BitewiseDB(`test-sync-${Math.random()}`)
  repo = new LogRepo(db)
})

afterEach(async () => {
  await db.delete()
})

async function signIn() {
  await db.syncMeta.add({
    userId: 'user-1',
    userEmail: 'a@b.com',
    userName: 'A',
    userAvatarUrl: null,
    lastSyncedAt: null,
  })
}

describe('syncTracker (via a repo write path), signed out', () => {
  it('does not queue an outbox entry for a guest write', async () => {
    await repo.addEntry(sampleEntry())
    expect(await db.syncOutbox.count()).toBe(0)
  })

  it('does not stamp clientId/updatedAt onto a guest-written row', async () => {
    const id = await repo.addEntry(sampleEntry())
    const row = await repo.getById(id)
    expect(row?.clientId).toBeUndefined()
    expect(row?.updatedAt).toBeUndefined()
  })
})

describe('syncTracker (via a repo write path), signed in', () => {
  beforeEach(signIn)

  it('stamps a fresh clientId and updatedAt onto a newly-added row', async () => {
    const id = await repo.addEntry(sampleEntry())
    const row = await repo.getById(id)
    expect(row?.clientId).toMatch(/^[0-9a-f-]{36}$/)
    expect(row?.updatedAt).toBeGreaterThan(0)
  })

  it('queues exactly one upsert outbox entry for a new row', async () => {
    await repo.addEntry(sampleEntry())
    const outbox = await db.syncOutbox.toArray()
    expect(outbox).toHaveLength(1)
    expect(outbox[0]).toMatchObject({ table: 'logEntries', operation: 'upsert' })
  })

  it('collapses an update into the same outbox entry rather than queuing a second one', async () => {
    const id = await repo.addEntry(sampleEntry())
    await repo.updateEntry(id, { qty: 3, kcal: 123 })

    const outbox = await db.syncOutbox.toArray()
    expect(outbox).toHaveLength(1)
    expect(outbox[0].operation).toBe('upsert')
    expect((outbox[0].payload as { kcal: number }).kcal).toBe(123)
  })

  it('preserves the original clientId across an update', async () => {
    const id = await repo.addEntry(sampleEntry())
    const original = (await repo.getById(id))?.clientId

    await repo.updateEntry(id, { qty: 3 })
    const afterUpdate = (await repo.getById(id))?.clientId

    expect(afterUpdate).toBe(original)
  })

  it('queues a delete tombstone (not a second upsert) when a synced row is deleted', async () => {
    const id = await repo.addEntry(sampleEntry())
    const clientId = (await repo.getById(id))?.clientId

    await repo.deleteEntry(id)

    const outbox = await db.syncOutbox.toArray()
    expect(outbox).toHaveLength(1)
    expect(outbox[0]).toMatchObject({ operation: 'delete', clientId, payload: null })
  })

  it('does not queue anything when deleting a row that was never synced (no clientId)', async () => {
    // Simulate a row that predates Phase 10 / was written while signed out.
    const id = await db.logEntries.add(sampleEntry() as LogEntry)
    await repo.deleteEntry(id)
    expect(await db.syncOutbox.count()).toBe(0)
  })
})
