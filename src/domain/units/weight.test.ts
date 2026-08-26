import { describe, expect, it } from 'vitest'
import { kgToLb, lbToKg } from './weight'

describe('kgToLb', () => {
  it('converts a typical weight', () => {
    expect(kgToLb(70)).toBeCloseTo(154.3, 1)
  })
})

describe('lbToKg', () => {
  it('converts a typical weight', () => {
    expect(lbToKg(154.3)).toBeCloseTo(70, 1)
  })

  it('round-trips within rounding error', () => {
    const original = 82.5
    expect(lbToKg(kgToLb(original))).toBeCloseTo(original, 1)
  })
})
