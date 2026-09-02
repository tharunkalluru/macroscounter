import type { VercelRequest, VercelResponse } from '@vercel/node'
import { describe, expect, it, vi } from 'vitest'
import { buildUserContent, validateRequestBody } from './analyze'
import handler from './analyze'
import { getUserId } from '../_auth.js'

vi.mock('../_auth.js', () => ({ getUserId: vi.fn() }))

function mockRes(): VercelResponse {
  const res = {} as VercelResponse
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe('validateRequestBody', () => {
  it('rejects a body with neither description nor image', () => {
    const result = validateRequestBody({})
    expect(result.ok).toBe(false)
  })

  it('accepts a description-only body, trimmed', () => {
    const result = validateRequestBody({ description: '  2 idli and sambar  ' })
    expect(result).toEqual({ ok: true, value: { description: '2 idli and sambar', image: undefined } })
  })

  it('rejects a description over the character cap', () => {
    const result = validateRequestBody({ description: 'x'.repeat(1001) })
    expect(result.ok).toBe(false)
  })

  it('accepts a valid image payload', () => {
    const result = validateRequestBody({ image: { data: 'aGVsbG8=', mediaType: 'image/jpeg' } })
    expect(result.ok).toBe(true)
  })

  it('rejects an image payload missing required fields', () => {
    const result = validateRequestBody({ image: { data: 'aGVsbG8=' } })
    expect(result.ok).toBe(false)
  })

  it('rejects an oversized image payload', () => {
    // 5.6M base64 chars decodes to ~4.2MB, just over the 4MB (4*1024*1024) cap.
    const result = validateRequestBody({ image: { data: 'a'.repeat(5_600_000), mediaType: 'image/jpeg' } })
    expect(result.ok).toBe(false)
  })
})

describe('buildUserContent', () => {
  it('builds a text-only content block for a description with no image', () => {
    const content = buildUserContent({ description: '100g grilled chicken breast' })
    expect(content).toEqual([{ type: 'text', text: '100g grilled chicken breast' }])
  })

  it('puts the image block before the text block when both are present', () => {
    const content = buildUserContent({
      description: 'no rice, extra portion',
      image: { data: 'aGVsbG8=', mediaType: 'image/jpeg' },
    })
    expect(content).toEqual([
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'aGVsbG8=' } },
      { type: 'text', text: 'no rice, extra portion' },
    ])
  })

  it('falls back to a generic prompt for an image with no description', () => {
    const content = buildUserContent({ image: { data: 'aGVsbG8=', mediaType: 'image/png' } })
    expect(content[1]).toEqual({ type: 'text', text: 'Analyse the food shown in this photo.' })
  })
})

describe('POST /api/ai/analyze', () => {
  it('returns 405 for a non-POST method', async () => {
    const req = { method: 'GET' } as unknown as VercelRequest
    const res = mockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('returns 401 with code "not_signed_in" for a guest', async () => {
    vi.mocked(getUserId).mockResolvedValue(null)
    const req = { method: 'POST', body: { description: 'a roti' } } as unknown as VercelRequest
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
      const req = { method: 'POST', body: { description: 'a roti' } } as unknown as VercelRequest
      const res = mockRes()
      await handler(req, res)
      expect(res.status).toHaveBeenCalledWith(503)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'missing_key' })
      )
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
})
