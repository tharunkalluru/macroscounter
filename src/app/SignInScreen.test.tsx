import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SignInScreen from './SignInScreen'

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  social: vi.fn(),
  emailSignIn: vi.fn(),
  emailSignUp: vi.fn(),
  emailOtpSignIn: vi.fn(),
  sendVerificationOtp: vi.fn(),
  requestPasswordReset: vi.fn(),
  session: { data: null as null | { user: { id: string } }, isPending: false },
}))
vi.mock('../lib/auth/authClient', () => ({
  useSession: () => mocks.session,
  signIn: { social: mocks.social, email: mocks.emailSignIn, emailOtp: mocks.emailOtpSignIn },
  signUp: { email: mocks.emailSignUp },
  signOut: vi.fn(),
  requestPasswordReset: mocks.requestPasswordReset,
  authClient: { emailOtp: { sendVerificationOtp: mocks.sendVerificationOtp } },
}))
vi.mock('../lib/sync/resolveAfterSignIn', () => ({ resolveAfterSignIn: mocks.resolve }))

beforeEach(() => {
  mocks.session = { data: null, isPending: false }
  mocks.resolve.mockReset()
  mocks.social.mockReset()
  mocks.emailSignIn.mockReset().mockResolvedValue({ error: null })
  mocks.emailSignUp.mockReset().mockResolvedValue({ error: null })
  mocks.emailOtpSignIn.mockReset().mockResolvedValue({ error: null })
  mocks.sendVerificationOtp.mockReset().mockResolvedValue({ error: null })
  mocks.requestPasswordReset.mockReset().mockResolvedValue({ error: null })
})
afterEach(cleanup)
function mount() {
  render(<MemoryRouter initialEntries={['/welcome']}><Routes>
    <Route path="/welcome" element={<SignInScreen />} /><Route path="/" element={<p>My diary</p>} />
  </Routes></MemoryRouter>)
}

describe('sign-in recovery', () => {
  it('shows a useful retry after restoring fails, then reaches the diary', async () => {
    mocks.session.data = { user: { id: 'account' } }
    mocks.resolve.mockRejectedValueOnce(new Error('Your backup could not be read. Please retry.')).mockResolvedValueOnce('ready')
    mount()
    expect(await screen.findByRole('alert')).toHaveTextContent('Your backup could not be read')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('My diary')).toBeInTheDocument()
    expect(mocks.resolve).toHaveBeenCalledTimes(2)
  })

  it('reenables Google sign-in after a network failure', async () => {
    mocks.social.mockRejectedValue(new Error('We could not connect to Google. Please try again.'))
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not connect')
    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeEnabled()
  })
})

describe('email + password sign-in', () => {
  it('signs in with email and password', async () => {
    mount()
    await userEvent.type(screen.getByTestId('signin-email-input'), 'tharun@example.com')
    await userEvent.type(screen.getByTestId('signin-password-input'), 'correct-horse')
    await userEvent.click(screen.getByTestId('signin-password-submit'))
    expect(mocks.emailSignIn).toHaveBeenCalledWith({ email: 'tharun@example.com', password: 'correct-horse' })
  })

  it('shows the server error on incorrect credentials', async () => {
    mocks.emailSignIn.mockResolvedValue({ error: { message: 'Incorrect email or password.' } })
    mount()
    await userEvent.type(screen.getByTestId('signin-email-input'), 'tharun@example.com')
    await userEvent.type(screen.getByTestId('signin-password-input'), 'wrong')
    await userEvent.click(screen.getByTestId('signin-password-submit'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')
  })

  it('switches to create-account and signs up', async () => {
    mount()
    await userEvent.click(screen.getByTestId('signin-show-signup'))
    await userEvent.type(screen.getByTestId('signup-name-input'), 'Tharun')
    await userEvent.type(screen.getByTestId('signup-email-input'), 'new@example.com')
    await userEvent.type(screen.getByTestId('signup-password-input'), 'longenoughpw')
    await userEvent.click(screen.getByTestId('signup-submit'))
    expect(mocks.emailSignUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'longenoughpw', name: 'Tharun' })
  })

  it('rejects a too-short signup password before calling the server', async () => {
    mount()
    await userEvent.click(screen.getByTestId('signin-show-signup'))
    await userEvent.type(screen.getByTestId('signup-email-input'), 'new@example.com')
    await userEvent.type(screen.getByTestId('signup-password-input'), 'short')
    await userEvent.click(screen.getByTestId('signup-submit'))
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 8 characters')
    expect(mocks.emailSignUp).not.toHaveBeenCalled()
  })

  it('requests a password reset link without revealing whether the account exists', async () => {
    mount()
    await userEvent.click(screen.getByText('Forgot password?'))
    await userEvent.type(screen.getByTestId('forgot-password-email-input'), 'someone@example.com')
    await userEvent.click(screen.getByTestId('forgot-password-submit'))
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
      email: 'someone@example.com',
      redirectTo: expect.stringContaining('/reset-password'),
    })
    expect(await screen.findByRole('status')).toHaveTextContent('reset link is on its way')
  })
})

describe('email code (OTP) sign-in', () => {
  it('sends a code, then verifies it to sign in', async () => {
    mount()
    await userEvent.click(screen.getByTestId('signin-method-code'))
    await userEvent.type(screen.getByTestId('code-email-input'), 'tharun@example.com')
    await userEvent.click(screen.getByTestId('code-send-submit'))
    expect(mocks.sendVerificationOtp).toHaveBeenCalledWith({ email: 'tharun@example.com', type: 'sign-in' })

    const otpInput = await screen.findByTestId('code-otp-input')
    await userEvent.type(otpInput, '123456')
    await userEvent.click(screen.getByTestId('code-verify-submit'))
    expect(mocks.emailOtpSignIn).toHaveBeenCalledWith({ email: 'tharun@example.com', otp: '123456' })
  })

  it('surfaces an invalid-code error', async () => {
    mocks.emailOtpSignIn.mockResolvedValue({ error: { message: 'That code is incorrect or has expired.' } })
    mount()
    await userEvent.click(screen.getByTestId('signin-method-code'))
    await userEvent.type(screen.getByTestId('code-email-input'), 'tharun@example.com')
    await userEvent.click(screen.getByTestId('code-send-submit'))
    await userEvent.type(await screen.findByTestId('code-otp-input'), '000000')
    await userEvent.click(screen.getByTestId('code-verify-submit'))
    expect(await screen.findByRole('alert')).toHaveTextContent('incorrect or has expired')
  })
})
