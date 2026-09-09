import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ResetPasswordPage from './ResetPasswordPage'

const mocks = vi.hoisted(() => ({ resetPassword: vi.fn() }))
vi.mock('../lib/auth/authClient', () => ({ resetPassword: mocks.resetPassword }))

beforeEach(() => {
  mocks.resetPassword.mockReset().mockResolvedValue({ error: null })
})
afterEach(cleanup)

function mount(initialPath: string) {
  render(<MemoryRouter initialEntries={[initialPath]}><Routes>
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/welcome" element={<p>Sign in screen</p>} />
  </Routes></MemoryRouter>)
}

describe('ResetPasswordPage', () => {
  it('asks the user to request a new link when the token is missing', () => {
    mount('/reset-password')
    expect(screen.getByText(/missing its reset code/)).toBeInTheDocument()
    expect(mocks.resetPassword).not.toHaveBeenCalled()
  })

  it('rejects a too-short password before calling the server', async () => {
    mount('/reset-password?token=abc123')
    await userEvent.type(screen.getByTestId('reset-password-new'), 'short')
    await userEvent.type(screen.getByTestId('reset-password-confirm'), 'short')
    await userEvent.click(screen.getByTestId('reset-password-submit'))
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 8 characters')
    expect(mocks.resetPassword).not.toHaveBeenCalled()
  })

  it('rejects mismatched passwords', async () => {
    mount('/reset-password?token=abc123')
    await userEvent.type(screen.getByTestId('reset-password-new'), 'longenoughpw')
    await userEvent.type(screen.getByTestId('reset-password-confirm'), 'somethingelse')
    await userEvent.click(screen.getByTestId('reset-password-submit'))
    expect(await screen.findByRole('alert')).toHaveTextContent('do not match')
    expect(mocks.resetPassword).not.toHaveBeenCalled()
  })

  it('resets the password and shows a link back to sign in', async () => {
    mount('/reset-password?token=abc123')
    await userEvent.type(screen.getByTestId('reset-password-new'), 'longenoughpw')
    await userEvent.type(screen.getByTestId('reset-password-confirm'), 'longenoughpw')
    await userEvent.click(screen.getByTestId('reset-password-submit'))
    expect(mocks.resetPassword).toHaveBeenCalledWith({ newPassword: 'longenoughpw', token: 'abc123' })
    expect(await screen.findByTestId('reset-password-done-link')).toBeInTheDocument()
  })

  it('shows the server error for an invalid/expired token', async () => {
    mocks.resetPassword.mockResolvedValue({ error: { message: 'This reset link is invalid or has expired.' } })
    mount('/reset-password?token=stale')
    await userEvent.type(screen.getByTestId('reset-password-new'), 'longenoughpw')
    await userEvent.type(screen.getByTestId('reset-password-confirm'), 'longenoughpw')
    await userEvent.click(screen.getByTestId('reset-password-submit'))
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid or has expired')
  })
})
