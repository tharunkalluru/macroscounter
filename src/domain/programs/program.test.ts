import { describe, expect, it } from 'vitest'
import type { Targets } from '../../data/models'
import { deriveCurrentProgram } from './program'

function target(overrides: Partial<Targets>): Targets {
  return {
    effectiveDate: '2026-08-01',
    kcal: 2000,
    proteinG: 150,
    carbsG: 200,
    fatG: 60,
    source: 'computed',
    ...overrides,
  }
}

describe('deriveCurrentProgram', () => {
  it('returns null with no target history', () => {
    expect(deriveCurrentProgram([], '2026-08-31')).toBeNull()
  })

  it('starts the program at the only computed target, week 1 on day one', () => {
    const result = deriveCurrentProgram([target({ effectiveDate: '2026-08-31' })], '2026-08-31')
    expect(result).toEqual({ startDate: '2026-08-31', weekNumber: 1, pastProgramsCount: 0 })
  })

  it('counts elapsed weeks since the program start', () => {
    const result = deriveCurrentProgram([target({ effectiveDate: '2026-08-01' })], '2026-08-22')
    // 21 days elapsed -> floor(21/7)+1 = 4
    expect(result?.weekNumber).toBe(4)
  })

  it('adaptive targets stay within the same program, not a new one', () => {
    const targets = [
      target({ effectiveDate: '2026-08-01', source: 'computed' }),
      target({ effectiveDate: '2026-08-08', source: 'adaptive' }),
      target({ effectiveDate: '2026-08-15', source: 'adaptive' }),
    ]
    const result = deriveCurrentProgram(targets, '2026-08-20')
    expect(result?.startDate).toBe('2026-08-01')
    expect(result?.pastProgramsCount).toBe(0)
  })

  it('a later computed target starts a new program and counts the earlier one as past', () => {
    const targets = [
      target({ effectiveDate: '2026-06-01', source: 'computed' }),
      target({ effectiveDate: '2026-06-08', source: 'adaptive' }),
      target({ effectiveDate: '2026-08-01', source: 'computed' }),
    ]
    const result = deriveCurrentProgram(targets, '2026-08-15')
    expect(result?.startDate).toBe('2026-08-01')
    expect(result?.pastProgramsCount).toBe(1)
  })

  it('falls back to the earliest target date when there is no computed source at all', () => {
    const targets = [target({ effectiveDate: '2026-07-01', source: 'adaptive' })]
    const result = deriveCurrentProgram(targets, '2026-08-15')
    expect(result?.startDate).toBe('2026-07-01')
    expect(result?.pastProgramsCount).toBe(0)
  })
})
