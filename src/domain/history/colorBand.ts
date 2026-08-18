export type DayColorBand = 'none' | 'green' | 'amber' | 'red'

/**
 * green: consumed <= target
 * amber: consumed <= 110% of target
 * red: consumed > 110% of target
 * none: no entries logged that day, or no target was in effect yet
 */
export function classifyDay(consumedKcal: number | undefined, targetKcal: number | undefined): DayColorBand {
  if (consumedKcal === undefined || targetKcal === undefined || targetKcal <= 0) return 'none'
  if (consumedKcal <= targetKcal) return 'green'
  if (consumedKcal <= targetKcal * 1.1) return 'amber'
  return 'red'
}
