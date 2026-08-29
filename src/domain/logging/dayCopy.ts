import type { LogEntry } from '../../data/models'
import { sumMacros } from './portionMath'

export interface DayCopySummary {
  count: number
  kcal: number
}

/**
 * Whether a "copy yesterday's whole log" prompt should be offered: today has
 * nothing logged yet (across all meals), and the previous day has entries to
 * copy. Keeps the prompt out of the way once the user has started their day.
 */
export function shouldOfferDayCopy(todayEntryCount: number, previousDayEntries: LogEntry[]): boolean {
  return todayEntryCount === 0 && previousDayEntries.length > 0
}

/** Item count + rounded total kcal for a previous day's entries, for prompt copy. */
export function summarizeDayCopy(previousDayEntries: LogEntry[]): DayCopySummary {
  return { count: previousDayEntries.length, kcal: Math.round(sumMacros(previousDayEntries).kcal) }
}
