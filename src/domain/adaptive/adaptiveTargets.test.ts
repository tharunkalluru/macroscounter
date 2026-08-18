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
    expect(result!.weeklyWeightChangeKg).toBe(-1)
    expect(result!.reason).toContain('lost 1.0 kg')
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
    // Ate 1688 mean (not the 1628 target) and lost 0.4kg -> a small, unclamped -50 adjustment.
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
    expect(result!.adjustment).toBe(-50) // within the +-100 clamp, so this is the exact unclamped value
    expect(result!.suggestedKcal).toBe(1578)
    expect(result!.meanLoggedKcal).toBe(1688)
  })

  it('on-track (exactly 0.5 kg/week loss) -> no change', () => {
    const result = computeAdaptiveAdjustment({
      loggedDays: sevenDays(1628),
      weighIns: [
        { date: '2026-08-12', weightKg: 80.0 },
        { date: '2026-08-18', weightKg: 79.5 },
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
