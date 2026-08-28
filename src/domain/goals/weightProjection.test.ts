import { describe, expect, it } from 'vitest'
import { projectGoalWeight } from './weightProjection'

describe('projectGoalWeight', () => {
  it('reports insufficient data with fewer than 3 weigh-ins', () => {
    const result = projectGoalWeight(
      [
        { date: '2026-08-01', weightKg: 80 },
        { date: '2026-08-05', weightKg: 79.5 },
      ],
      70,
      '2026-08-27'
    )
    expect(result.status).toBe('insufficient-data')
  })

  it('reports insufficient data when the logged span is under 7 days', () => {
    const result = projectGoalWeight(
      [
        { date: '2026-08-20', weightKg: 80 },
        { date: '2026-08-21', weightKg: 79.9 },
        { date: '2026-08-22', weightKg: 79.8 },
      ],
      70,
      '2026-08-27'
    )
    expect(result.status).toBe('insufficient-data')
  })

  it('reports at-goal when already within tolerance of the target', () => {
    const result = projectGoalWeight(
      [
        { date: '2026-08-01', weightKg: 70.2 },
        { date: '2026-08-10', weightKg: 70.1 },
        { date: '2026-08-20', weightKg: 70.0 },
      ],
      70,
      '2026-08-27'
    )
    expect(result.status).toBe('at-goal')
  })

  it('projects an ETA for a steady loss trend moving toward a lower goal', () => {
    const weighIns = []
    for (let day = 0; day <= 20; day++) {
      const date = `2026-08-${String(day + 1).padStart(2, '0')}`
      weighIns.push({ date, weightKg: 90 - day * 0.1 })
    }
    const result = projectGoalWeight(weighIns, 80, '2026-08-21')
    expect(result.status).toBe('on-track')
    expect(result.weeklyRateKg).toBeLessThan(0)
    expect(result.daysRemaining).toBeGreaterThan(0)
    expect(result.projectedDate).toBeDefined()
  })

  it('projects an ETA for a steady gain trend moving toward a higher goal', () => {
    const weighIns = []
    for (let day = 0; day <= 20; day++) {
      const date = `2026-08-${String(day + 1).padStart(2, '0')}`
      weighIns.push({ date, weightKg: 60 + day * 0.1 })
    }
    const result = projectGoalWeight(weighIns, 70, '2026-08-21')
    expect(result.status).toBe('on-track')
    expect(result.weeklyRateKg).toBeGreaterThan(0)
    expect(result.daysRemaining).toBeGreaterThan(0)
  })

  it('reports plateaued when weight is essentially flat', () => {
    const weighIns = []
    for (let day = 0; day <= 20; day++) {
      const date = `2026-08-${String(day + 1).padStart(2, '0')}`
      weighIns.push({ date, weightKg: 80 + (day % 2 === 0 ? 0.05 : -0.05) })
    }
    const result = projectGoalWeight(weighIns, 70, '2026-08-21')
    expect(result.status).toBe('plateaued')
  })

  it('reports wrong-direction when trending away from the goal', () => {
    const weighIns = []
    for (let day = 0; day <= 20; day++) {
      const date = `2026-08-${String(day + 1).padStart(2, '0')}`
      weighIns.push({ date, weightKg: 80 + day * 0.1 })
    }
    const result = projectGoalWeight(weighIns, 70, '2026-08-21')
    expect(result.status).toBe('wrong-direction')
    expect(result.weeklyRateKg).toBeGreaterThan(0)
  })

  it('treats an implausibly slow trend the same as a plateau rather than a far-future date', () => {
    const weighIns = []
    for (let day = 0; day <= 20; day++) {
      const date = `2026-08-${String(day + 1).padStart(2, '0')}`
      weighIns.push({ date, weightKg: 80 - day * 0.01 })
    }
    const result = projectGoalWeight(weighIns, 50, '2026-08-21')
    expect(result.status).toBe('plateaued')
  })
})
