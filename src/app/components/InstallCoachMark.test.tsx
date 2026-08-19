import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import InstallCoachMark from './InstallCoachMark'

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}

function setStandalone(standalone: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(display-mode: standalone)' && standalone,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

beforeEach(() => {
  localStorage.clear()
  setStandalone(false)
  setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('InstallCoachMark', () => {
  it('renders nothing when already running standalone', () => {
    setStandalone(true)
    render(<InstallCoachMark />)
    expect(screen.queryByTestId('install-coach-mark')).not.toBeInTheDocument()
  })

  it('renders nothing on a non-iOS browser with no beforeinstallprompt fired', () => {
    render(<InstallCoachMark />)
    expect(screen.queryByTestId('install-coach-mark')).not.toBeInTheDocument()
  })

  it('shows the native install trigger once beforeinstallprompt fires', () => {
    render(<InstallCoachMark />)

    const preventDefault = vi.fn()
    const promptEvent = Object.assign(new Event('beforeinstallprompt'), {
      preventDefault,
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    fireEvent(window, promptEvent)

    expect(screen.getByTestId('install-coach-mark')).toBeInTheDocument()
    expect(screen.getByTestId('install-coach-mark-install')).toBeInTheDocument()
    expect(preventDefault).toHaveBeenCalled() // suppresses Chrome's own mini-infobar
  })

  it('clicking Install calls prompt() and dismisses the banner', async () => {
    render(<InstallCoachMark />)
    const prompt = vi.fn().mockResolvedValue(undefined)
    fireEvent(
      window,
      Object.assign(new Event('beforeinstallprompt'), {
        preventDefault: () => {},
        prompt,
        userChoice: Promise.resolve({ outcome: 'accepted' as const }),
      })
    )

    fireEvent.click(screen.getByTestId('install-coach-mark-install'))
    expect(prompt).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByTestId('install-coach-mark')).not.toBeInTheDocument())
  })

  it('shows Share -> Add to Home Screen instructions on iOS, with no beforeinstallprompt', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')
    render(<InstallCoachMark />)

    expect(screen.getByTestId('install-coach-mark')).toBeInTheDocument()
    expect(screen.queryByTestId('install-coach-mark-install')).not.toBeInTheDocument()
    expect(screen.getByText(/Add to Home Screen/)).toBeInTheDocument()
  })

  it('dismissing persists across a remount', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')
    const { unmount } = render(<InstallCoachMark />)
    fireEvent.click(screen.getByTestId('install-coach-mark-dismiss'))
    expect(screen.queryByTestId('install-coach-mark')).not.toBeInTheDocument()

    unmount()
    render(<InstallCoachMark />)
    expect(screen.queryByTestId('install-coach-mark')).not.toBeInTheDocument()
  })
})
