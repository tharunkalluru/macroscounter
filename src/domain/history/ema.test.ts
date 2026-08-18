import { describe, expect, it } from 'vitest'
import { computeEMA } from './ema'

describe('computeEMA', () => {
  it('matches a hand-computed 7-day EMA fixture series', () => {
    const weights = [80, 79.8, 80.2, 79.5, 79.7, 79.3, 79.6, 79.1]
    const series = weights.map((weightKg, i) => ({
      date: `2026-08-${String(i + 1).padStart(2, '0')}`,
      weightKg,
    }))

    const result = computeEMA(series, 7)
    const emas = result.map((r) => r.ema)

    expect(emas).toEqual([80, 79.95, 80.01, 79.88, 79.84, 79.7, 79.68, 79.53])
  })

  it('seeds the EMA at the first point when there is only one data point', () => {
    const result = computeEMA([{ date: '2026-08-01', weightKg: 75.4 }])
    expect(result).toEqual([{ date: '2026-08-01', weightKg: 75.4, ema: 75.4 }])
  })

  it('returns an empty array for no data', () => {
    expect(computeEMA([])).toEqual([])
  })

  it('sorts out-of-order input by date before computing', () => {
    const result = computeEMA(
      [
        { date: '2026-08-02', weightKg: 79.8 },
        { date: '2026-08-01', weightKg: 80 },
      ],
      7
    )
    expect(result.map((r) => r.date)).toEqual(['2026-08-01', '2026-08-02'])
    expect(result.map((r) => r.ema)).toEqual([80, 79.95])
  })
})
