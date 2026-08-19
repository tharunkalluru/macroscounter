import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useCountUp } from './useCountUp'

// No matchMedia stub here on purpose: jsdom has no matchMedia by default, and
// framer-motion's useReducedMotion() treats that as "no preference" (see
// node_modules/framer-motion's initPrefersReducedMotion, which only calls
// matchMedia when it exists) — exactly the real-world "not set" case this
// file wants to exercise. See the sibling *.reducedMotion.test.tsx for the
// opposite preference, kept in its own file for module-registry isolation.
afterEach(() => {
  // no-op — kept for symmetry with the reduced-motion sibling file
})

function Probe({ target }: { target: number }) {
  const value = useCountUp(target, 300)
  return <span data-testid="value">{value}</span>
}

describe('useCountUp with no reduced-motion preference', () => {
  it('does not jump straight to the new target — it animates toward it over time', () => {
    const { rerender } = render(<Probe target={100} />)
    expect(screen.getByTestId('value')).toHaveTextContent('100')

    act(() => {
      rerender(<Probe target={250} />)
    })

    // Without reduced motion, the count-up hasn't reached the target yet on
    // the same tick — it still needs animation frames to get there.
    expect(screen.getByTestId('value')).not.toHaveTextContent('250')
  })
})
