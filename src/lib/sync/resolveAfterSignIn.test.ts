import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MacroDesiDB } from '../../data/db'
import { ProfileRepo } from '../../data/repos/ProfileRepo'

const mockGetSession = vi.fn()
vi.mock('../auth/authClient', () => ({
  authClient: { getSession: () => mockGetSession() },
}))

// Import after the mock so `resolveAfterSignIn`'s own `authClient` import
// resolves to the mocked module above.
const { resolveAfterSignIn } = await import('./resolveAfterSignIn')

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

let db: MacroDesiDB
let server: ReturnType<typeof createMockServer>

beforeEach(() => {
  db = new MacroDesiDB(`test-resolve-${Math.random()}`)
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
  mockGetSession.mockReset()
  await db.delete()
})

describe('resolveAfterSignIn', () => {
  it('brand-new account with nothing anywhere -> onboarding', async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com', name: 'A', image: null } },
    })

    const outcome = await resolveAfterSignIn(db)

    expect(outcome).toBe('onboarding')
    const meta = await db.syncMeta.toCollection().first()
    expect(meta?.userId).toBe('u1')
    expect(await db.profiles.count()).toBe(0)
  })

  it('returning user whose account already has server data -> pulled, ready', async () => {
    server.rows.set('profiles:remote-p1', {
      id: 'remote-p1',
      clientId: 'remote-p1',
      userId: 'u2',
      name: 'Remote Persona',
      sex: 'male',
      age: 30,
      heightCm: 175,
      weightKg: 80,
      activityLevel: 'moderate',
      goal: 'cut',
      updatedAt: Date.now() - 1000,
      deletedAt: null,
    })
    mockGetSession.mockResolvedValue({
      data: { user: { id: 'u2', email: 'b@b.com', name: 'B', image: null } },
    })

    const outcome = await resolveAfterSignIn(db)

    expect(outcome).toBe('ready')
    const localProfile = await db.profiles.toCollection().first()
    expect(localProfile?.name).toBe('Remote Persona')
  })

  it('existing local (guest) data, server has nothing for this account -> migrated up, ready', async () => {
    await new ProfileRepo(db).save({
      name: 'Guest Persona',
      sex: 'female',
      age: 25,
      heightCm: 160,
      weightKg: 55,
      activityLevel: 'light',
      goal: 'maintain',
    })
    mockGetSession.mockResolvedValue({
      data: { user: { id: 'u3', email: 'c@b.com', name: 'C', image: null } },
    })

    const outcome = await resolveAfterSignIn(db)

    expect(outcome).toBe('ready')
    const localProfile = await db.profiles.toCollection().first()
    expect(localProfile?.name).toBe('Guest Persona') // unchanged, not overwritten
    expect([...server.rows.keys()].filter((k) => k.startsWith('profiles:'))).toHaveLength(1)
  })

  it('no active session -> onboarding, without writing syncMeta', async () => {
    mockGetSession.mockResolvedValue({ data: null })

    const outcome = await resolveAfterSignIn(db)

    expect(outcome).toBe('onboarding')
    expect(await db.syncMeta.count()).toBe(0)
  })
})
