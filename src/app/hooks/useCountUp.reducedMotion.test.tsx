import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountUp } from './useCountUp'

// framer-motion's useReducedMotion() lazily detects and caches the OS
// preference once per module load, so this file mocks matchMedia to
// "reduce" and stays isolated from the "normal motion" test file (which
// needs the opposite value) — see the sibling *.normalMotion.test.tsx.
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function Probe({ target }: { target: number }) {
  const value = useCountUp(target, 300)
  return <span data-testid="value">{value}</span>
}

describe('useCountUp with prefers-reduced-motion enabled', () => {
  it('jumps straight to the new target with no intermediate frames', () => {
    const { rerender } = render(<Probe target={100} />)
    expect(screen.getByTestId('value')).toHaveTextContent('100')

    act(() => {
      rerender(<Probe target={250} />)
    })

    expect(screen.getByTestId('value')).toHaveTextContent('250')
  })
})
