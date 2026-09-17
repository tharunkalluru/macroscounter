import { describe, expect, it } from 'vitest'
import { computeAdaptiveAdjustment, type DayKcal, type WeighInPoint } from './adaptiveTargets'

const REF_DATE = '2026-08-18'

function sevenDays(kcal: number): DayKcal[] {
  const days: DayKcal[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(2026, 7, 12 + i)
    days.push({
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      kcal,
    })
  }
  return days
}

describe('computeAdaptiveAdjustment', () => {
  it('losing too fast (1.0 kg/week vs 0.5 kg/week goal) -> target is raised (clamped +100)', () => {
    const result = computeAdaptiveAdjustment({
      loggedDays: sevenDays(1500),
      weighIns: [
        { date: '2026-08-12', weightKg: 80.0 },
        { date: '2026-08-18', weightKg: 79.0 },
      ],
      currentTargetKcal: 1500,
      floorKcal: 1200,
      referenceDate: REF_DATE,
    })
    expect(result).not.toBeNull()
    expect(result!.adjustment).toBe(100)
    expect(result!.suggestedKcal).toBe(1600)
    expect(result!.weeklyWeightChangeKg).toBe(-1.2)
    expect(result!.reason).toContain('lost 1.2 kg')
    expect(result!.reason).toContain('raising')
  })

  it('plateau (no weight change) -> target is lowered (clamped -100)', () => {
    const result = computeAdaptiveAdjustment({
      loggedDays: sevenDays(1800),
      weighIns: [
        { date: '2026-08-12', weightKg: 80.0 },
        { date: '2026-08-18', weightKg: 80.0 },
      ],
      currentTargetKcal: 1800,
      floorKcal: 1200,
      referenceDate: REF_DATE,
    })
    expect(result).not.toBeNull()
    expect(result!.adjustment).toBe(-100)
    expect(result!.suggestedKcal).toBe(1700)
    expect(result!.weeklyWeightChangeKg).toBe(0)
    expect(result!.reason).toContain('stayed about the same')
    expect(result!.reason).toContain('lowering')
  })

  it('insufficient logged days (<7 in the window) -> no-op (null)', () => {
    const fiveDays = sevenDays(1800).slice(0, 5)
    const result = computeAdaptiveAdjustment({
      loggedDays: fiveDays,
      weighIns: [
        { date: '2026-08-12', weightKg: 80.0 },
        { date: '2026-08-18', weightKg: 79.5 },
      ],
      currentTargetKcal: 1800,
      floorKcal: 1200,
      referenceDate: REF_DATE,
    })
    expect(result).toBeNull()
  })

  it('insufficient weigh-in data (<2 in the window) -> no-op (null)', () => {
    const result = computeAdaptiveAdjustment({
      loggedDays: sevenDays(1800),
      weighIns: [{ date: '2026-08-18', weightKg: 79.5 }],
      currentTargetKcal: 1800,
      floorKcal: 1200,
      referenceDate: REF_DATE,
    })
    expect(result).toBeNull()
  })

  it('never suggests below the floor, even when the raw adjustment would go lower', () => {
    const result = computeAdaptiveAdjustment({
      loggedDays: sevenDays(1250),
      weighIns: [
        { date: '2026-08-12', weightKg: 60.0 },
        { date: '2026-08-18', weightKg: 60.0 },
      ],
      currentTargetKcal: 1250,
      floorKcal: 1200,
      referenceDate: REF_DATE,
    })
    expect(result).not.toBeNull()
    // Unclamped-by-floor math would want 1150 kcal, but the floor is 1200.
    expect(result!.suggestedKcal).toBe(1200)
  })

  it('uses actual logged intake, not just the weight trend, when they diverge from the current target', () => {
    // Ate 1688 mean (not the 1628 target) and lost 0.4kg -> a small adjustment using the actual six-day weight interval.
    const result = computeAdaptiveAdjustment({
      loggedDays: sevenDays(1688),
      weighIns: [
        { date: '2026-08-12', weightKg: 80.0 },
        { date: '2026-08-18', weightKg: 79.6 },
      ],
      currentTargetKcal: 1628,
      floorKcal: 1200,
      referenceDate: REF_DATE,
    })
    expect(result).not.toBeNull()
    expect(result!.adjustment).toBe(23) // within the +-100 clamp, so this is the exact unclamped value
    expect(result!.suggestedKcal).toBe(1651)
    expect(result!.meanLoggedKcal).toBe(1688)
  })

  it('normalizes six elapsed days to a weekly rate -> no change on target', () => {
    const result = computeAdaptiveAdjustment({
      loggedDays: sevenDays(1628),
      weighIns: [
        { date: '2026-08-12', weightKg: 80.0 },
        { date: '2026-08-18', weightKg: 80 - 0.5 * 6 / 7 },
      ],
      currentTargetKcal: 1628,
      floorKcal: 1200,
      referenceDate: REF_DATE,
    })
    expect(result).not.toBeNull()
    expect(result!.adjustment).toBe(0)
    expect(result!.suggestedKcal).toBe(1628)
    expect(result!.reason).toContain('no change needed')
  })

  it('weigh-ins outside the 7-day window are ignored', () => {
    const weighIns: WeighInPoint[] = [
      { date: '2026-07-01', weightKg: 90.0 }, // way outside window
      { date: '2026-08-12', weightKg: 80.0 },
      { date: '2026-08-18', weightKg: 80.0 },
    ]
    const result = computeAdaptiveAdjustment({
      loggedDays: sevenDays(1800),
      weighIns,
      currentTargetKcal: 1800,
      floorKcal: 1200,
      referenceDate: REF_DATE,
    })
    expect(result!.weeklyWeightChangeKg).toBe(0) // not skewed by the July weigh-in
  })
})


describe('goal-aware evidence and safeguards', () => {
  const base = { loggedDays: sevenDays(2000), weighIns: [{ date: '2026-08-12', weightKg: 80 }, { date: REF_DATE, weightKg: 80 }], currentTargetKcal: 2000, floorKcal: 1200, referenceDate: REF_DATE }
  it('does not apply a weight-loss deficit to maintenance or gain goals', () => {
    expect(computeAdaptiveAdjustment({ ...base, goal: 'maintain' })?.adjustment).toBe(0)
    expect(computeAdaptiveAdjustment({ ...base, goal: 'gain' })?.adjustment).toBe(100)
    expect(computeAdaptiveAdjustment({ ...base, goal: 'cut' })?.adjustment).toBe(-100)
    expect(computeAdaptiveAdjustment({ ...base, goal: 'gain' })?.reason).toContain('gain goal')
  })
  it('honors the selected rate instead of an assumed half-kilogram loss', () => {
    const result = computeAdaptiveAdjustment({ ...base, goal: 'gain', goalRateLbPerWeek: 0.1 })
    expect(result?.adjustment).toBe(50)
    expect(result?.reason).toContain('0.05 kg/week gain goal')
  })
  it('does not mistake duplicate dates for seven days of evidence', () => {
    expect(computeAdaptiveAdjustment({ ...base, loggedDays: Array.from({ length: 7 }, () => ({ date: REF_DATE, kcal: 2000 })) })).toBeNull()
  })
  it('does not extrapolate from same-day or next-day weight noise', () => {
    expect(computeAdaptiveAdjustment({ ...base, weighIns: [{ date: '2026-08-17', weightKg: 80 }, { date: REF_DATE, weightKg: 79 }] })).toBeNull()
  })
  it('reports the actual change when the calorie floor limits it', () => {
    const result = computeAdaptiveAdjustment({ ...base, currentTargetKcal: 1250, loggedDays: sevenDays(1250) })
    expect(result?.suggestedKcal).toBe(1200)
    expect(result?.adjustment).toBe(-50)
    expect(result?.reason).toContain('50 kcal')
  })
})
