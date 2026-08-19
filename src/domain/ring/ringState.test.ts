import { describe, expect, it } from 'vitest'
import { computeRingState } from './ringState'

describe('computeRingState', () => {
  it('under target: normal band, positive remaining, partial fill', () => {
    const state = computeRingState(800, 2000)
    expect(state.band).toBe('normal')
    expect(state.centerText).toBe('1200')
    expect(state.subLabel).toBe('kcal remaining')
    expect(state.fillPct).toBeCloseTo(0.4, 5)
  })

  it('exactly at target (100%): still normal band, full ring, zero remaining', () => {
    const state = computeRingState(2000, 2000)
    expect(state.band).toBe('normal')
    expect(state.centerText).toBe('0')
    expect(state.fillPct).toBe(1)
  })

  it('over target (>100%): flips to the over band with a "+n over" center', () => {
    const state = computeRingState(2041, 2000)
    expect(state.band).toBe('over')
    expect(state.centerText).toBe('+41')
    expect(state.subLabel).toBe('over')
    expect(state.fillPct).toBe(1)
  })

  it('rounds the displayed center number', () => {
    expect(computeRingState(799.6, 2000).centerText).toBe('1200')
    expect(computeRingState(2050.6, 2000).centerText).toBe('+51')
  })

  it('handles a zero target without dividing by zero', () => {
    const state = computeRingState(0, 0)
    expect(state.band).toBe('normal')
    expect(state.fillPct).toBe(0)
  })

  it('handles zero consumed', () => {
    const state = computeRingState(0, 1628)
    expect(state.band).toBe('normal')
    expect(state.centerText).toBe('1628')
    expect(state.fillPct).toBe(0)
  })

  it('clamps fillPct to 1 even fractionally under the over threshold', () => {
    const state = computeRingState(2000, 2000)
    expect(state.fillPct).toBeLessThanOrEqual(1)
  })
})
