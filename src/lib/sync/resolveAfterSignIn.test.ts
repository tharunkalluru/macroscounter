import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BitewiseDB } from '../../data/db'
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

let db: BitewiseDB
let server: ReturnType<typeof createMockServer>

beforeEach(() => {
  db = new BitewiseDB(`test-resolve-${Math.random()}`)
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

  it('same account signs back in after signing out -> local data is kept, not wiped', async () => {
    await new ProfileRepo(db).save({
      name: 'Same Persona',
      sex: 'male',
      age: 28,
      heightCm: 170,
      weightKg: 70,
      activityLevel: 'sedentary',
      goal: 'cut',
    })
    // Simulate a prior sign-in-then-sign-out for this same account: userId is
    // cleared (signed out) but linkedUserId (set by the earlier sign-in)
    // persists, exactly as signOutLocally leaves it.
    await db.syncMeta.add({
      userId: null,
      userEmail: null,
      userName: null,
      userAvatarUrl: null,
      lastSyncedAt: 12345,
      linkedUserId: 'u1',
    })
    mockGetSession.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com', name: 'A', image: null } },
    })

    const outcome = await resolveAfterSignIn(db)

    expect(outcome).toBe('ready')
    const localProfile = await db.profiles.toCollection().first()
    expect(localProfile?.name).toBe('Same Persona')
  })

  it('a different account signs in on a device with another account\'s local data -> local data wiped, never migrated or mixed in', async () => {
    // Person A's leftover local data — still sitting on this device after
    // they signed out (signOutLocally never clears local rows).
    await new ProfileRepo(db).save({
      name: 'Person A',
      sex: 'male',
      age: 40,
      heightCm: 180,
      weightKg: 90,
      activityLevel: 'active',
      goal: 'gain',
    })
    await db.syncMeta.add({
      userId: null,
      userEmail: null,
      userName: null,
      userAvatarUrl: null,
      lastSyncedAt: 99999,
      linkedUserId: 'user-a',
    })

    // Person B signs in on the same device with a brand-new account.
    mockGetSession.mockResolvedValue({
      data: { user: { id: 'user-b', email: 'b@b.com', name: 'B', image: null } },
    })

    const outcome = await resolveAfterSignIn(db)

    // Nothing on the server for B, and A's local data must never be migrated
    // up under B's account -- so this is a fresh account, straight to onboarding.
    expect(outcome).toBe('onboarding')
    expect(await db.profiles.count()).toBe(0)
    expect(server.rows.size).toBe(0)
    const meta = await db.syncMeta.toCollection().first()
    expect(meta?.linkedUserId).toBe('user-b')
  })

  it('a different account signs in and already has server data -> local wiped first, then only B\'s data is visible', async () => {
    await new ProfileRepo(db).save({
      name: 'Person A',
      sex: 'male',
      age: 40,
      heightCm: 180,
      weightKg: 90,
      activityLevel: 'active',
      goal: 'gain',
    })
    await db.syncMeta.add({
      userId: null,
      userEmail: null,
      userName: null,
      userAvatarUrl: null,
      lastSyncedAt: 99999,
      linkedUserId: 'user-a',
    })

    server.rows.set('profiles:remote-b1', {
      id: 'remote-b1',
      clientId: 'remote-b1',
      userId: 'user-b',
      name: 'Person B',
      sex: 'female',
      age: 22,
      heightCm: 165,
      weightKg: 58,
      activityLevel: 'light',
      goal: 'maintain',
      updatedAt: Date.now() - 1000,
      deletedAt: null,
    })
    mockGetSession.mockResolvedValue({
      data: { user: { id: 'user-b', email: 'b@b.com', name: 'B', image: null } },
    })

    const outcome = await resolveAfterSignIn(db)

    expect(outcome).toBe('ready')
    const profiles = await db.profiles.toArray()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].name).toBe('Person B')
  })
})
