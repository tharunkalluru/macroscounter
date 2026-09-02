import type { VercelRequest, VercelResponse } from '@vercel/node'
import { describe, expect, it, vi } from 'vitest'
import { validateRequestBody } from './coach-chat'
import handler from './coach-chat'
import { getUserId } from '../_auth.js'

vi.mock('../_auth.js', () => ({ getUserId: vi.fn() }))

// A chainable stub that resolves to `[]` from any `.from().where()` call,
// regardless of which table is queried -- enough to exercise the "signed in
// but hasn't finished onboarding yet" (no profile row) path without needing
// a real Postgres connection.
function emptyChain() {
  const chain = {
    where: () => chain,
    limit: () => chain,
    then: (resolve: (v: unknown[]) => void) => resolve([]),
  }
  return chain
}

vi.mock('../_db.js', () => ({
  getDb: vi.fn(() => ({ select: () => ({ from: () => emptyChain() }) })),
  schema: {
    profiles: {},
    targets: {},
    weighIns: {},
    logEntries: {},
  },
}))

function mockRes(): VercelResponse {
  const res = {} as VercelResponse
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('validateRequestBody', () => {
  it('rejects an empty body', () => {
    expect(validateRequestBody({}).ok).toBe(false)
  })

  it('rejects a blank/whitespace-only message', () => {
    expect(validateRequestBody({ message: '   ' }).ok).toBe(false)
  })

  it('accepts a message-only body, trimmed', () => {
    const result = validateRequestBody({ message: '  how am I doing this week?  ' })
    expect(result).toEqual({ ok: true, value: { message: 'how am I doing this week?', history: undefined } })
  })

  it('rejects a message over the character cap', () => {
    expect(validateRequestBody({ message: 'x'.repeat(1001) }).ok).toBe(false)
  })

  it('accepts valid history alongside a message', () => {
    const result = validateRequestBody({
      message: 'and today?',
      history: [
        { role: 'user', content: 'how was my week?' },
        { role: 'assistant', content: 'Pretty solid overall.' },
      ],
    })
    expect(result.ok).toBe(true)
  })

  it('rejects history with an invalid role', () => {
    const result = validateRequestBody({
      message: 'hi',
      history: [{ role: 'system', content: 'x' }],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects history longer than the cap', () => {
    const history = Array.from({ length: 21 }, () => ({ role: 'user' as const, content: 'x' }))
    expect(validateRequestBody({ message: 'hi', history }).ok).toBe(false)
  })
})

describe('POST /api/ai/coach-chat', () => {
  it('returns 405 for a non-POST method', async () => {
    const req = { method: 'GET' } as unknown as VercelRequest
    const res = mockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 401 with code "not_signed_in" for a guest', async () => {
    vi.mocked(getUserId).mockResolvedValue(null)
    const req = { method: 'POST', body: { message: 'hi' } } as unknown as VercelRequest
    const res = mockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'not_signed_in' }))
  })

  it('returns 503 with code "missing_key" when signed in but ANTHROPIC_API_KEY is unset', async () => {
    vi.mocked(getUserId).mockResolvedValue('user_1')
    const original = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    try {
      const req = { method: 'POST', body: { message: 'hi' } } as unknown as VercelRequest
      const res = mockRes()
      await handler(req, res)
      expect(res.status).toHaveBeenCalledWith(503)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'missing_key' }))
    } finally {
      if (original !== undefined) process.env.ANTHROPIC_API_KEY = original
    }
  })

  it('returns 400 with code "invalid_input" for an empty body when signed in', async () => {
    vi.mocked(getUserId).mockResolvedValue('user_1')
    process.env.ANTHROPIC_API_KEY = 'test-key-not-used-in-this-path'
    const req = { method: 'POST', body: {} } as unknown as VercelRequest
    const res = mockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid_input' }))
  })

  it('returns 400 with code "no_profile" for a signed-in user with no synced profile row', async () => {
    vi.mocked(getUserId).mockResolvedValue('user_1')
    process.env.ANTHROPIC_API_KEY = 'test-key-not-used-in-this-path'
    const req = { method: 'POST', body: { message: 'how am I doing?' } } as unknown as VercelRequest
    const res = mockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'no_profile' }))
  })
})
