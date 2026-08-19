import type { VercelRequest, VercelResponse } from '@vercel/node'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import pullHandler from './pull'
import pushHandler from './push'

// Same rationale as api/_auth.test.ts: these env vars only need to be
// syntactically present so getAuth()/getDb() can construct — the 401 path
// under test never reaches the database.
beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb'
  process.env.AUTH_SECRET = 'test-secret-used-only-in-unit-tests-32c'
  process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
})

function mockRes(): VercelResponse {
  const res = {} as VercelResponse
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('sync routes reject unauthenticated requests', () => {
  it('POST /api/sync/push returns 401 without a session cookie', async () => {
    const req = { method: 'POST', headers: {}, body: { mutations: [] } } as unknown as VercelRequest
    const res = mockRes()
    await pushHandler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Not signed in' })
  })

  it('GET /api/sync/pull returns 401 without a session cookie', async () => {
    const req = { method: 'GET', headers: {}, query: {} } as unknown as VercelRequest
    const res = mockRes()
    await pullHandler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'Not signed in' })
  })
})
