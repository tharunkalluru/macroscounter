import type { VercelRequest } from '@vercel/node'
import { beforeAll, describe, expect, it } from 'vitest'
import { getUserId } from './_auth'

// getAuth() lazily constructs a real Better Auth instance on first call, so
// it needs syntactically-valid env vars even in tests — but the assertion
// below only exercises Better Auth's no-cookie short-circuit (see
// node_modules/better-auth/dist/api/routes/session.mjs: `if
// (!sessionCookieToken) return null` happens before any adapter/DB call),
// so nothing here ever actually connects to Postgres.
beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb'
  process.env.AUTH_SECRET = 'test-secret-used-only-in-unit-tests-32c'
  process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
})

describe('getUserId', () => {
  it('returns null when the request carries no session cookie', async () => {
    const req = { headers: {} } as VercelRequest
    await expect(getUserId(req)).resolves.toBeNull()
  })

  it('returns null for an unrelated cookie header with no Better Auth session token', async () => {
    const req = { headers: { cookie: 'unrelated=1; other=2' } } as VercelRequest
    await expect(getUserId(req)).resolves.toBeNull()
  })
})
