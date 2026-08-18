export interface WeightPoint {
  date: string
  weightKg: number
}

export interface WeightPointWithEma extends WeightPoint {
  ema: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * N-day exponential moving average trend line over a weight series.
 * Seeds the EMA at the first (earliest-dated) data point, matching the
 * standard convention when no prior history exists.
 */
export function computeEMA(series: WeightPoint[], windowDays = 7): WeightPointWithEma[] {
  if (series.length === 0) return []

  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date))
  const alpha = 2 / (windowDays + 1)

  const result: WeightPointWithEma[] = []
  let prevEma = sorted[0].weightKg
  for (let i = 0; i < sorted.length; i++) {
    const point = sorted[i]
    const ema = i === 0 ? point.weightKg : alpha * point.weightKg + (1 - alpha) * prevEma
    prevEma = ema
    result.push({ ...point, ema: round2(ema) })
  }
  return result
}
