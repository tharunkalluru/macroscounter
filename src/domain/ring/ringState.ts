export type RingBand = 'normal' | 'over'

export interface RingState {
  band: RingBand
  /** Text for the ring's center number — "1587" when under/at target, "+41" when over. */
  centerText: string
  /** Sub-label under the center number. */
  subLabel: 'kcal remaining' | 'over'
  /** 0..1, clamped — how much of the ring's circumference to fill. */
  fillPct: number
}

/** >100% of target consumed flips the ring to the over-budget (amber) band. */
export function computeRingState(consumedKcal: number, targetKcal: number): RingState {
  const remaining = targetKcal - consumedKcal
  const over = remaining < 0

  if (over) {
    const overAmount = Math.round(Math.abs(remaining))
    return {
      band: 'over',
      centerText: `+${overAmount}`,
      subLabel: 'over',
      fillPct: 1,
    }
  }

  const pct = targetKcal > 0 ? consumedKcal / targetKcal : 0
  return {
    band: 'normal',
    centerText: `${Math.round(remaining)}`,
    subLabel: 'kcal remaining',
    fillPct: Math.min(1, Math.max(0, pct)),
  }
}
