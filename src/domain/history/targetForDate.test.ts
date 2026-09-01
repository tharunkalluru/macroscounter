import { describe, expect, it } from 'vitest'
import { findApplicableTarget } from './targetForDate'

const targets = [
  { effectiveDate: '2026-08-01', kcal: 1700 },
  { effectiveDate: '2026-08-10', kcal: 1800 },
  { effectiveDate: '2026-08-18', kcal: 1628 },
]

describe('findApplicableTarget', () => {
  it('returns the target with the latest effectiveDate <= the given date', () => {
    expect(findApplicableTarget('2026-08-15', targets)?.kcal).toBe(1800)
  })

  it('returns an exact match when the date equals an effectiveDate', () => {
    expect(findApplicableTarget('2026-08-18', targets)?.kcal).toBe(1628)
  })

  it('returns undefined when the date is before any target existed', () => {
    expect(findApplicableTarget('2026-07-01', targets)).toBeUndefined()
  })

  it('is order-independent for distinct effectiveDates', () => {
    const shuffled = [targets[2], targets[0], targets[1]]
    expect(findApplicableTarget('2026-08-15', shuffled)?.kcal).toBe(1800)
  })

  it('when two targets share an effectiveDate, the one later in the array wins', () => {
    // Same-day Coach check-in: the freshly-accepted adaptive target (added
    // after, so it sorts later out of TargetRepo.getAll()) supersedes the
    // original target computed earlier that same day.
    const sameDay = [
      { effectiveDate: '2026-08-18', kcal: 2786 },
      { effectiveDate: '2026-08-18', kcal: 2686 },
    ]
    expect(findApplicableTarget('2026-08-18', sameDay)?.kcal).toBe(2686)
  })
})
