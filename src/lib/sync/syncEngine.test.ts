import { afterEach, describe, expect, it, vi } from 'vitest'
import { BitewiseDB } from '../../data/db'
import { onSyncDataChanged, runSync } from './syncEngine'

function freshDb() {
  return new BitewiseDB(`sync-test-${Math.random().toString(36).slice(2)}`)
}

/** A row as `/api/sync/pull` actually returns it: Postgres PK + userId included. */
function remoteLogEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'uuid-a',
    userId: 'user-1',
    clientId: 'uuid-a',
    date: '2026-09-08',
    meal: 'breakfast',
    name: 'Idli',
    portionSummary: '40 g',
    portionLabel: null,
    qty: 40,
    unit: 'grams',
    grams: 40,
    kcal: 41,
    p: 1.8,
    c: 8,
    f: 0.2,
    updatedAt: 5_000,
    deletedAt: null,
    ...overrides,
  }
}

function stubFetch(pull: { tables: Record<string, unknown[]>; pulledAt?: number }) {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes('/api/sync/pull')) {
      return { ok: true, json: async () => pull } as never
    }
    return { ok: true, json: async () => ({ flushed: [] }) } as never
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function signedInDb() {
  const db = freshDb()
  await db.syncMeta.add({ userId: 'user-1', linkedUserId: 'user-1', lastSyncedAt: 1 } as never)
  return db
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('runSync — pulling rows onto this device', () => {
  it('keeps the local numeric primary key instead of adopting the server row id', async () => {
    const db = await signedInDb()
    const localId = await db.logEntries.add({
      clientId: 'uuid-a',
      date: '2026-09-08',
      meal: 'breakfast',
      name: 'Idli',
      portionSummary: '40 g',
      qty: 40,
      unit: 'grams',
      grams: 40,
      kcal: 41,
      p: 1.8,
      c: 8,
      f: 0.2,
      updatedAt: 1_000,
    } as never)

    stubFetch({ tables: { logEntries: [remoteLogEntry({ name: 'Idli (edited elsewhere)' })] } })
    await runSync(db)

    const rows = await db.logEntries.toArray()
    expect(rows).toHaveLength(1)
    // The edit came through...
    expect(rows[0].name).toBe('Idli (edited elsewhere)')
    // ...without the server's uuid replacing the local autoincrement key,
    // which is what silently broke edit/delete-by-id on the second device.
    expect(rows[0].id).toBe(localId)
    expect(typeof rows[0].id).toBe('number')
    expect((rows[0] as unknown as { userId?: string }).userId).toBeUndefined()
  })

  it('inserts a brand-new remote row with a local numeric key, not the server uuid', async () => {
    const db = await signedInDb()
    stubFetch({ tables: { logEntries: [remoteLogEntry({ id: 'uuid-new', clientId: 'uuid-new' })] } })

    await runSync(db)

    const rows = await db.logEntries.toArray()
    expect(rows).toHaveLength(1)
    expect(typeof rows[0].id).toBe('number')
    expect(rows[0].clientId).toBe('uuid-new')
    expect((rows[0] as unknown as { userId?: string }).userId).toBeUndefined()
  })

  it('is a no-op when the same rows come back again (pulls deliberately overlap)', async () => {
    const db = await signedInDb()
    stubFetch({ tables: { logEntries: [remoteLogEntry()] }, pulledAt: 10_000 })

    await runSync(db)
    const afterFirst = await db.logEntries.toArray()

    const changed = vi.fn()
    const unsubscribe = onSyncDataChanged(changed)
    await runSync(db)
    unsubscribe()

    const afterSecond = await db.logEntries.toArray()
    expect(afterSecond).toEqual(afterFirst)
    // Critical: re-merging identical rows must not report a change, or the
    // "pull merged something -> refresh the UI" signal would loop forever.
    expect(changed).not.toHaveBeenCalled()
  })

  it('notifies once when a pull actually brings something new', async () => {
    const db = await signedInDb()
    stubFetch({ tables: { logEntries: [remoteLogEntry()] } })

    const changed = vi.fn()
    const unsubscribe = onSyncDataChanged(changed)
    await runSync(db)
    unsubscribe()

    expect(changed).toHaveBeenCalledTimes(1)
  })

  it('rewinds the stored watermark behind the server clock to absorb device skew', async () => {
    const db = await signedInDb()
    stubFetch({ tables: {}, pulledAt: 10_000_000 })

    await runSync(db)

    const meta = await db.syncMeta.toCollection().first()
    // A hairline watermark drops rows written by a device whose clock runs
    // slightly behind, so the next pull re-reads a safety window.
    expect(meta?.lastSyncedAt).toBeLessThan(10_000_000)
    expect(meta?.lastSyncedAt).toBeGreaterThan(0)
  })

  it('applies a remote soft-delete to the local row', async () => {
    const db = await signedInDb()
    await db.logEntries.add({
      clientId: 'uuid-a',
      date: '2026-09-08',
      meal: 'breakfast',
      name: 'Idli',
      portionSummary: '40 g',
      qty: 40,
      unit: 'grams',
      grams: 40,
      kcal: 41,
      p: 1.8,
      c: 8,
      f: 0.2,
      updatedAt: 1_000,
    } as never)

    stubFetch({ tables: { logEntries: [remoteLogEntry({ deletedAt: 6_000 })] } })
    await runSync(db)

    expect(await db.logEntries.count()).toBe(0)
  })

  it('leaves a locally-newer row alone', async () => {
    const db = await signedInDb()
    await db.logEntries.add({
      clientId: 'uuid-a',
      date: '2026-09-08',
      meal: 'breakfast',
      name: 'Local wins',
      portionSummary: '40 g',
      qty: 40,
      unit: 'grams',
      grams: 40,
      kcal: 41,
      p: 1.8,
      c: 8,
      f: 0.2,
      updatedAt: 9_999,
    } as never)

    stubFetch({ tables: { logEntries: [remoteLogEntry({ name: 'Stale remote', updatedAt: 5_000 })] } })
    await runSync(db)

    const rows = await db.logEntries.toArray()
    expect(rows[0].name).toBe('Local wins')
  })

  it('does nothing for a guest (no signed-in user)', async () => {
    const db = freshDb()
    const fetchMock = stubFetch({ tables: {} })

    await runSync(db)

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
