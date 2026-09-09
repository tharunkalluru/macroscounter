import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: mocks.send } })),
}))

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  vi.resetModules()
  mocks.send.mockReset().mockResolvedValue({ data: { id: 'email_1' }, error: null })
  process.env = { ...ORIGINAL_ENV }
  delete process.env.RESEND_API_KEY
  delete process.env.RESEND_FROM_EMAIL
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('sendResetPasswordEmail', () => {
  it('does nothing (and does not throw) when RESEND_API_KEY is unset', async () => {
    const { sendResetPasswordEmail } = await import('./_email.js')
    await expect(sendResetPasswordEmail('user@example.com', 'https://app/reset?token=abc')).resolves.toBeUndefined()
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('sends via Resend with the reset link, defaulting the from-address', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    const { sendResetPasswordEmail } = await import('./_email.js')
    await sendResetPasswordEmail('user@example.com', 'https://app/reset?token=abc')
    expect(mocks.send).toHaveBeenCalledTimes(1)
    const call = mocks.send.mock.calls[0][0]
    expect(call.to).toBe('user@example.com')
    expect(call.from).toContain('resend.dev')
    expect(call.subject).toContain('Reset your Bitewise password')
    expect(call.html).toContain('https://app/reset?token=abc')
  })

  it('uses RESEND_FROM_EMAIL when configured', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    process.env.RESEND_FROM_EMAIL = 'Bitewise <hello@bitewise.app>'
    const { sendResetPasswordEmail } = await import('./_email.js')
    await sendResetPasswordEmail('user@example.com', 'https://app/reset?token=abc')
    expect(mocks.send.mock.calls[0][0].from).toBe('Bitewise <hello@bitewise.app>')
  })

  it('does not throw when Resend returns an error', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    mocks.send.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'bad request' } })
    const { sendResetPasswordEmail } = await import('./_email.js')
    await expect(sendResetPasswordEmail('user@example.com', 'https://app/reset')).resolves.toBeUndefined()
  })
})

describe('sendOTPEmail', () => {
  it('does nothing when RESEND_API_KEY is unset', async () => {
    const { sendOTPEmail } = await import('./_email.js')
    await expect(sendOTPEmail('user@example.com', '123456', 'sign-in')).resolves.toBeUndefined()
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('sends the code with a type-specific subject', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    const { sendOTPEmail } = await import('./_email.js')
    await sendOTPEmail('user@example.com', '654321', 'sign-in')
    const call = mocks.send.mock.calls[0][0]
    expect(call.subject).toBe('Your Bitewise sign-in code')
    expect(call.html).toContain('654321')
  })

  it('falls back to a generic subject for an unrecognized type', async () => {
    process.env.RESEND_API_KEY = 'test-key'
    const { sendOTPEmail } = await import('./_email.js')
    await sendOTPEmail('user@example.com', '111111', 'something-new')
    expect(mocks.send.mock.calls[0][0].subject).toBe('Your Bitewise verification code')
  })
})
