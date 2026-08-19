import { useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

// Matches the ring-sweep easing (cubic-bezier(0.22, 1, 0.36, 1)).
function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5)
}

/** Animates from the previous value to `target` over `durationMs`. Instant under prefers-reduced-motion. */
export function useCountUp(target: number, durationMs = 300): number {
  const prefersReducedMotion = useReducedMotion()
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const from = fromRef.current
    if (prefersReducedMotion || from === target) {
      setDisplay(target)
      fromRef.current = target
      return
    }

    const start = performance.now()
    function tick(now: number) {
      const elapsed = now - start
      const t = Math.min(1, elapsed / durationMs)
      const eased = easeOutQuint(t)
      setDisplay(Math.round(from + (target - from) * eased))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs, prefersReducedMotion])

  return display
}
