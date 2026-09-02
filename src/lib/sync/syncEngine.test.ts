import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LogRepo } from '../../data/repos/LogRepo'
import { BitewiseDB } from '../../data/db'
import { getSyncStatus, runSync } from './syncEngine'

/**
 * A minimal in-memory stand-in for /api/sync/push + /api/sync/pull, so this
 * test exercises the *real* client sync engine (outbox, LWW merge, status
 * transitions) against a fake network boundary instead of a live Neon DB —
 * matching the spec's "Integration: mock server" gate requirement for 10.1.
 */
function createMockServer() {
  const rows = new Map<string, Record<string, unknown> & { updatedAt: number; deletedAt: number | null }>()

  async function handlePush(body: string) {
    const { mutations } = JSON.parse(body) as {
      mutations: { table: string; clientId: string; operation: string; payload: unknown; updatedAt: number }[]
    }
    const flushed = []
    for (const m of mutations) {
      const key = `${m.table}:${m.clientId}`
      const existing = rows.get(key)
      if (existing && existing.updatedAt > m.updatedAt) continue // server has something newer
      if (m.operation === 'delete') {
        rows.set(key, { ...(existing ?? {}), updatedAt: m.updatedAt, deletedAt: m.updatedAt })
      } else {
        rows.set(key, { ...(m.payload as object), updatedAt: m.updatedAt, deletedAt: null })
      }
      flushed.push({ table: m.table, clientId: m.clientId, updatedAt: m.updatedAt })
    }
    return { flushed }
  }

  function handlePull(since: number) {
    const tables: Record<string, unknown[]> = {}
    for (const [key, row] of rows) {
      const [table] = key.split(':')
      if (row.updatedAt <= since) continue
      tables[table] ??= []
      tables[table].push(row)
    }
    return { tables, pulledAt: Date.now() }
  }

  return { rows, handlePush, handlePull }
}

let db: BitewiseDB
let repo: LogRepo
let server: ReturnType<typeof createMockServer>

beforeEach(async () => {
  db = new BitewiseDB(`test-syncengine-${Math.random()}`)
  repo = new LogRepo(db)
  server = createMockServer()

  await db.syncMeta.add({
    userId: 'user-1',
    userEmail: 'a@b.com',
    userName: 'A',
    userAvatarUrl: null,
    lastSyncedAt: null,
  })

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url, 'http://localhost')
      if (u.pathname === '/api/sync/push') {
        const body = await server.handlePush(init!.body as string)
        return new Response(JSON.stringify(body), { status: 200 })
      }
      if (u.pathname === '/api/sync/pull') {
        const since = Number(u.searchParams.get('since') ?? 0)
        return new Response(JSON.stringify(server.handlePull(since)), { status: 200 })
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

describe('runSync', () => {
  it('is a no-op and reports "signed-out" for a guest', async () => {
    await db.syncMeta.clear()
    await runSync(db)
    expect(getSyncStatus()).toBe('signed-out')
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('reports "offline" and skips the network when navigator.onLine is false', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    await runSync(db)
    expect(getSyncStatus()).toBe('offline')
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('flushes a queued offline write on the next sync and clears the local outbox', async () => {
    // "Offline write queues": adding an entry while signed in always queues
    // an outbox entry, regardless of connectivity (the outbox itself has no
    // idea whether we're online — runSync is what actually attempts the
    // network call).
    await repo.addEntry({
      date: '2026-08-18',
      meal: 'breakfast',
      foodId: 'idli',
      name: 'Idli',
      portionSummary: '1 idli',
      qty: 1,
      unit: 'portion',
      grams: 40,
      kcal: 41,
      p: 1.8,
      c: 8,
      f: 0.2,
    })
    expect(await db.syncOutbox.count()).toBe(1)

    // "Reconnect -> flush": runSync pushes the queued mutation.
    await runSync(db)

    expect(await db.syncOutbox.count()).toBe(0)
    expect(getSyncStatus()).toBe('synced')
    expect(server.rows.get('logEntries:' + (await db.logEntries.toCollection().first())!.clientId)).toBeTruthy()
  })

  it('a pull merges a row from another device into the local table', async () => {
    // Simulate another device having already pushed a row for this user.
    server.rows.set('weighIns:remote-row-1', {
      id: 'remote-row-1',
      clientId: 'remote-row-1',
      userId: 'user-1',
      date: '2026-08-17',
      weightKg: 78.4,
      updatedAt: Date.now(),
      deletedAt: null,
    })

    await runSync(db)

    const local = await db.weighIns.toArray()
    expect(local).toHaveLength(1)
    expect(local[0].weightKg).toBe(78.4)
    expect(local[0].clientId).toBe('remote-row-1')
  })

  it('a fresh (cleared-IndexedDB) session pulls all prior data on first sync', async () => {
    server.rows.set('logEntries:existing-1', {
      id: 'existing-1',
      clientId: 'existing-1',
      userId: 'user-1',
      date: '2026-08-10',
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
      updatedAt: Date.now() - 10_000,
      deletedAt: null,
    })

    // A brand-new local db (as if IndexedDB was cleared / a new device),
    // signed in, with no prior sync history (lastSyncedAt = null -> since=0).
    const freshDb = new BitewiseDB(`test-fresh-${Math.random()}`)
    await freshDb.syncMeta.add({
      userId: 'user-1',
      userEmail: 'a@b.com',
      userName: 'A',
      userAvatarUrl: null,
      lastSyncedAt: null,
    })

    await runSync(freshDb)

    const entries = await freshDb.logEntries.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('Chicken Curry')

    await freshDb.delete()
  })

  it('local-newer-than-remote wins a conflicting push (last-write-wins)', async () => {
    const id = await repo.addEntry({
      date: '2026-08-18',
      meal: 'dinner',
      name: 'Local Edit',
      portionSummary: '1 idli',
      qty: 1,
      unit: 'portion',
      grams: 40,
      kcal: 41,
      p: 1.8,
      c: 8,
      f: 0.2,
    })
    const clientId = (await repo.getById(id))!.clientId!

    // Seed the "server" with an OLDER row for the same clientId, simulating
    // a stale write from another device that should lose.
    server.rows.set(`logEntries:${clientId}`, {
      id: clientId,
      clientId,
      userId: 'user-1',
      name: 'Stale Remote',
      updatedAt: Date.now() - 60_000,
      deletedAt: null,
    })

    await runSync(db)

    const local = await db.logEntries.get(id)
    expect(local?.name).toBe('Local Edit')
  })
})
