import { afterEach, describe, expect, it, vi } from 'vitest'
import { vibrateTiny } from './haptics'

describe('vibrateTiny', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    // @ts-expect-error -- cleaning up a test-only stub
    delete navigator.vibrate
  })

  it('calls navigator.vibrate(10) when the Vibration API is available', () => {
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })

    vibrateTiny()

    expect(vibrate).toHaveBeenCalledWith(10)
  })

  it('does nothing when navigator.vibrate is unavailable', () => {
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true })

    expect(() => vibrateTiny()).not.toThrow()
  })
})
