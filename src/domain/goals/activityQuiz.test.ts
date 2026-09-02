import { describe, expect, it } from 'vitest'
import { resolveActivityLevel } from './activityQuiz'

describe('resolveActivityLevel', () => {
  it('all-lowest answers resolve to sedentary', () => {
    expect(resolveActivityLevel('sedentary', 'none', 'none')).toBe('sedentary')
  })

  it('all-highest answers resolve to very_active', () => {
    expect(resolveActivityLevel('very_active', 'frequent', 'advanced')).toBe('very_active')
  })

  it('a middling mix resolves to moderate', () => {
    expect(resolveActivityLevel('moderately_active', 'moderate', 'beginner')).toBe('moderate')
  })

  it('low daily movement with frequent, experienced training still resolves above sedentary/light', () => {
    expect(resolveActivityLevel('sedentary', 'frequent', 'intermediate')).toBe('moderate')
  })

  it('is monotonic: adding lifting experience never lowers the resolved level', () => {
    const low = resolveActivityLevel('sedentary', 'light', 'none')
    const high = resolveActivityLevel('sedentary', 'light', 'advanced')
    const order: Record<string, number> = { sedentary: 0, light: 1, moderate: 2, active: 3, very_active: 4 }
    expect(order[high]).toBeGreaterThanOrEqual(order[low])
  })
})
