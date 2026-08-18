import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('redirects to onboarding and renders the MacroDesi shell when no profile exists', async () => {
    render(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    )
    expect(await screen.findByRole('heading', { name: /macrodesi/i })).toBeInTheDocument()
  })
})
