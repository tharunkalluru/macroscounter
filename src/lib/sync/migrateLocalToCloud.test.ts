import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MacroDesiDB } from '../../data/db'
import { LogRepo } from '../../data/repos/LogRepo'
import { ProfileRepo } from '../../data/repos/ProfileRepo'
import { WeighInRepo } from '../../data/repos/WeighInRepo'
import { migrateLocalToCloud } from './migrateLocalToCloud'

/** Same mock-server shape as syncEngine.test.ts — a fake network boundary for /api/sync/*. */
function createMockServer() {
  const rows = new Map<string, Record<string, unknown> & { updatedAt: number; deletedAt: number | null }>()

  async function handlePush(body: string) {
    const { mutations } = JSON.parse(body) as {
      mutations: { table: string; clientId: string; operation: string; payload: unknown; updatedAt: number }[]
    }
    const flushed = []
    for (const m of mutations) {
      const key = `${m.table}:${m.clientId}`
      rows.set(key, { ...(m.payload as object), updatedAt: m.updatedAt, deletedAt: null })
      flushed.push({ table: m.table, clientId: m.clientId, updatedAt: m.updatedAt })
    }
    return { flushed }
  }

  function handlePull() {
    return { tables: {}, pulledAt: Date.now() }
  }

  return { rows, handlePush, handlePull }
}

let db: MacroDesiDB
let server: ReturnType<typeof createMockServer>

beforeEach(() => {
  db = new MacroDesiDB(`test-migrate-${Math.random()}`)
  server = createMockServer()

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url, 'http://localhost')
      if (u.pathname === '/api/sync/push') {
        const body = await server.handlePush(init!.body as string)
        return new Response(JSON.stringify(body), { status: 200 })
      }
      if (u.pathname === '/api/sync/pull') {
        return new Response(JSON.stringify(server.handlePull()), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    })
  )
  vi.stubGlobal('navigator', { onLine: true })
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await db.delete()
})

describe('migrateLocalToCloud', () => {
  it('pushes every pre-existing local row and reports accurate counts (guest data adopted into a new account)', async () => {
    // Guest usage: no syncMeta row yet, so these writes never touched the outbox.
    await new ProfileRepo(db).save({
      name: 'Migrated Persona',
      sex: 'male',
      age: 30,
      heightCm: 175,
      weightKg: 80,
      activityLevel: 'moderate',
      goal: 'cut',
    })
    const logRepo = new LogRepo(db)
    await logRepo.addEntry({
      date: '2026-08-15',
      meal: 'breakfast',
      name: 'Idli',
      portionSummary: '3 idli',
      qty: 3,
      unit: 'portion',
      grams: 120,
      kcal: 123,
      p: 5.4,
      c: 24,
      f: 0.6,
    })
    await logRepo.addEntry({
      date: '2026-08-16',
      meal: 'lunch',
      name: 'Chicken Curry',
      portionSummary: '100 g',
      qty: 1,
      unit: 'grams',
      grams: 100,
      kcal: 161,
      p: 15,
      c: 5,
      f: 9,
    })
    await new WeighInRepo(db).add({ date: '2026-08-15', weightKg: 80 })

    // Verify the guest precondition: nothing queued yet.
    expect(await db.syncOutbox.count()).toBe(0)

    const localKcalChecksum = (await db.logEntries.toArray()).reduce((sum, e) => sum + e.kcal, 0)

    // Sign-in just happened — syncMeta now exists, server has nothing yet.
    await db.syncMeta.add({
      userId: 'user-migrated',
      userEmail: 'a@b.com',
      userName: 'A',
      userAvatarUrl: null,
      lastSyncedAt: null,
    })

    const rowCounts = await migrateLocalToCloud(db)

    expect(rowCounts.profiles).toBe(1)
    expect(rowCounts.logEntries).toBe(2)
    expect(rowCounts.weighIns).toBe(1)

    // Count assertion: every local row made it to the (mock) server.
    const serverLogEntryRows = [...server.rows.keys()].filter((k) => k.startsWith('logEntries:'))
    expect(serverLogEntryRows).toHaveLength(2)
    expect([...server.rows.keys()].filter((k) => k.startsWith('profiles:'))).toHaveLength(1)
    expect([...server.rows.keys()].filter((k) => k.startsWith('weighIns:'))).toHaveLength(1)

    // Checksum assertion: the pushed rows' data matches, not just the count.
    const serverKcalChecksum = serverLogEntryRows.reduce(
      (sum, key) => sum + (server.rows.get(key)!.kcal as number),
      0
    )
    expect(serverKcalChecksum).toBe(localKcalChecksum)

    // The outbox is fully drained after the push.
    expect(await db.syncOutbox.count()).toBe(0)

    // Every migrated row now carries a clientId (assigned during migration).
    const entries = await db.logEntries.toArray()
    expect(entries.every((e) => !!e.clientId)).toBe(true)
  })

  it('is a no-op (zero counts everywhere) when there is no local data to migrate', async () => {
    await db.syncMeta.add({
      userId: 'user-empty',
      userEmail: 'a@b.com',
      userName: 'A',
      userAvatarUrl: null,
      lastSyncedAt: null,
    })

    const rowCounts = await migrateLocalToCloud(db)

    expect(Object.values(rowCounts).every((count) => count === 0)).toBe(true)
    expect(server.rows.size).toBe(0)
  })
})
