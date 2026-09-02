import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('redirects to onboarding and renders the Bitewise shell when no profile exists', async () => {
    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    )
    expect(await screen.findByRole('heading', { name: /bitewise/i })).toBeInTheDocument()
  })
})
