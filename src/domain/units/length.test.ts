import { describe, expect, it } from 'vitest'
import { cmToFeetInches, feetInchesToCm } from './length'

describe('cmToFeetInches', () => {
  it('converts a typical height', () => {
    expect(cmToFeetInches(175)).toEqual({ feet: 5, inches: 9 })
  })

  it('rounds to the nearest whole inch', () => {
    // 180 cm = 70.866 in -> rounds to 71 in = 5'11"
    expect(cmToFeetInches(180)).toEqual({ feet: 5, inches: 11 })
  })

  it('never returns 12 inches (rolls over into an extra foot)', () => {
    // 182.9 cm ~= 72.0 in exactly -> 6'0", not 5'12"
    expect(cmToFeetInches(182.9)).toEqual({ feet: 6, inches: 0 })
  })
})

describe('feetInchesToCm', () => {
  it('converts feet+inches back to cm', () => {
    expect(feetInchesToCm(5, 9)).toBeCloseTo(175.3, 1)
  })

  it('round-trips within 1 inch of precision', () => {
    const original = 168
    const { feet, inches } = cmToFeetInches(original)
    const roundTripped = feetInchesToCm(feet, inches)
    expect(Math.abs(roundTripped - original)).toBeLessThan(1.3)
  })
})
