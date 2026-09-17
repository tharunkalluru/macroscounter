import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler, { extractSetup, SETUP_PROMPT, setupRequestSchema } from './setup'
import { normalizeSetupResponse } from '../../src/domain/ai/setup'
import Anthropic from '@anthropic-ai/sdk'

const mock = vi.hoisted(() => ({ getUserId: vi.fn(), allow: vi.fn(), parse: vi.fn() }))
vi.mock('../_auth.js', () => ({ getUserId: mock.getUserId }))
vi.mock('../_aiBudget.js', () => ({ allowAiRequest: mock.allow }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    static RateLimitError = class extends Error {}
    messages = { parse: mock.parse }
  },
}))

const draft = {
  name: 'Taylor',
  age: 32,
  sex: null,
  heightCm: 175,
  weightKg: 75,
  activityLevel: 'moderate',
  goal: 'maintain',
  dietStyle: null,
}
function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  } as unknown as VercelResponse
}
function request(body: unknown, method = 'POST') {
  return { method, body } as VercelRequest
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-only-unused-key')
  mock.getUserId.mockResolvedValue('account-a')
  mock.allow.mockResolvedValue(true)
  mock.parse.mockResolvedValue({ parsed_output: { draft, notes: ['Sex was not supplied.'] } })
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('setup draft boundary', () => {
  it('trims input and rejects blank, overlong, extra fields and non-string descriptions', () => {
    expect(setupRequestSchema.parse({ description: '  desk job  ' })).toEqual({
      description: 'desk job',
    })
    for (const body of [
      { description: ' ' },
      { description: 'x'.repeat(1501) },
      { description: 42 },
      { description: 'Hello', userId: 'other' },
    ]) {
      expect(setupRequestSchema.safeParse(body).success).toBe(false)
    }
  })
  it('nulls invalid values rather than inventing defaults or accepting unsupported enums', () => {
    const result = normalizeSetupResponse({
      draft: {
        ...draft,
        age: 17,
        sex: 'unknown',
        weightKg: -20,
        heightCm: '175',
        dietStyle: 'vegan',
        activityLevel: 'athlete',
      },
      notes: [],
    })
    expect(result?.draft).toEqual({
      ...draft,
      age: null,
      sex: null,
      weightKg: null,
      heightCm: null,
      dietStyle: null,
      activityLevel: null,
    })
    expect(normalizeSetupResponse({ draft: null })).toBeNull()
  })
  it('extracts with structured output and explicit non-inference restrictions', async () => {
    const result = await extractSetup(
      new Anthropic({ apiKey: 'test' }),
      'I am Taylor, 32, 175 cm, 75 kg. Maintain my weight.'
    )
    expect(result?.draft).toEqual(draft)
    const sent = mock.parse.mock.calls[0][0]
    expect(sent.messages[0].content).toContain('175 cm')
    expect(sent.output_config.format).toBeDefined()
    expect(SETUP_PROMPT).toContain('Never infer sex from a name')
    expect(SETUP_PROMPT).toContain('not coaching')
    expect(SETUP_PROMPT).toContain('Do not include calorie or macro targets')
  })
})

describe('POST /api/ai/setup', () => {
  it('requires POST and an authenticated identity before invoking AI', async () => {
    const wrongMethod = response()
    await handler(request({}, 'GET'), wrongMethod)
    expect(wrongMethod.status).toHaveBeenCalledWith(405)
    mock.getUserId.mockResolvedValue(null)
    const guest = response()
    await handler(request({ description: 'Hello' }), guest)
    expect(guest.status).toHaveBeenCalledWith(401)
    expect(mock.allow).not.toHaveBeenCalled()
    expect(mock.parse).not.toHaveBeenCalled()
  })
  it('does not consume the budget on invalid input or missing configuration', async () => {
    const invalid = response()
    await handler(request({ description: '' }), invalid)
    expect(invalid.status).toHaveBeenCalledWith(400)
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const missing = response()
    await handler(request({ description: 'Hello' }), missing)
    expect(missing.status).toHaveBeenCalledWith(503)
    expect(mock.allow).not.toHaveBeenCalled()
  })
  it('uses the authenticated user for the budget and returns the agreed draft shape', async () => {
    const res = response()
    await handler(request({ description: 'I am Taylor, age 32.' }), res)
    expect(mock.allow).toHaveBeenCalledWith('account-a', res)
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
    expect(res.json).toHaveBeenCalledWith({ draft, notes: ['Sex was not supplied.'] })
  })
  it('honors a depleted budget without a provider call', async () => {
    mock.allow.mockResolvedValue(false)
    await handler(request({ description: 'Hello' }), response())
    expect(mock.parse).not.toHaveBeenCalled()
  })
  it('returns a usable fallback for malformed provider output without exposing provider errors', async () => {
    mock.parse.mockResolvedValueOnce({ parsed_output: null })
    const malformed = response()
    await handler(request({ description: 'Hello' }), malformed)
    expect(malformed.status).toHaveBeenCalledWith(502)
    mock.parse.mockRejectedValueOnce(new Error('secret upstream details'))
    const failed = response()
    await handler(request({ description: 'Hello' }), failed)
    expect(failed.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'upstream_error' }))
    expect(JSON.stringify(vi.mocked(failed.json).mock.calls)).not.toContain('secret')
  })
})
