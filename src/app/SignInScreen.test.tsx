import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SignInScreen from './SignInScreen'

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), social: vi.fn(), session: { data: null as null | { user: { id: string } }, isPending: false } }))
vi.mock('../lib/auth/authClient', () => ({ useSession: () => mocks.session, signIn: { social: mocks.social }, signOut: vi.fn() }))
vi.mock('../lib/sync/resolveAfterSignIn', () => ({ resolveAfterSignIn: mocks.resolve }))

beforeEach(() => {
  mocks.session = { data: null, isPending: false }
  mocks.resolve.mockReset()
  mocks.social.mockReset()
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
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled())
  })
})
