import { describe, expect, it } from 'vitest'
import { resolveActivityLevel } from './activityQuiz'

describe('resolveActivityLevel', () => {
  it('all-lowest answers resolve to sedentary', () => {
    expect(resolveActivityLevel('desk', 'none', 'low')).toBe('sedentary')
  })

  it('all-highest answers resolve to very_active', () => {
    expect(resolveActivityLevel('physical', 'frequent', 'high')).toBe('very_active')
  })

  it('a middling mix resolves to moderate', () => {
    expect(resolveActivityLevel('on_feet', 'moderate', 'moderate')).toBe('moderate')
  })

  it('a desk job with frequent exercise still resolves above sedentary/light', () => {
    expect(resolveActivityLevel('desk', 'frequent', 'moderate')).toBe('moderate')
  })

  it('is monotonic: adding movement never lowers the resolved level', () => {
    const low = resolveActivityLevel('desk', 'light', 'low')
    const high = resolveActivityLevel('desk', 'light', 'high')
    const order: Record<string, number> = { sedentary: 0, light: 1, moderate: 2, active: 3, very_active: 4 }
    expect(order[high]).toBeGreaterThanOrEqual(order[low])
  })
})
