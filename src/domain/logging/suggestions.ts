import type { Meal, Unit } from '../../data/models'
import { addDaysISO } from '../../lib/date'

export interface SuggestionSourceEntry {
  date: string
  meal: Meal
  foodId?: string
  name: string
  qty: number
  unit: Unit
  grams: number
  portionLabel?: string
}

export interface SuggestionEntry {
  foodId: string
  name: string
  qty: number
  unit: Unit
  grams: number
  portionLabel?: string
}

export interface SuggestionChip {
  /** Stable key for the combo (its signature), for React list keys and dedup. */
  key: string
  /** e.g. "3 idli + sambar" */
  label: string
  entries: SuggestionEntry[]
  /** How many days in the lookback window this exact combo recurred — the "logged N×" count on the full Your-usuals screen. */
  count: number
}

function comboSignature(entries: SuggestionEntry[]): string {
  return entries
    .map((e) => `${e.foodId}:${e.qty}:${e.unit}`)
    .sort()
    .join('|')
}

function comboLabel(entries: SuggestionEntry[]): string {
  return entries
    .map((e) => (e.qty > 1 ? `${e.qty} ${e.name}` : e.name))
    .join(' + ')
}

/**
 * Finds the most-logged food combo(s) for a given meal slot over the trailing
 * `windowDays` (default 14), for use as one-tap "Your usual?" suggestion
 * chips on that meal's empty state. Only entries with a `foodId` are
 * considered (custom/recipe entries aren't replayable via a chip tap). A
 * "combo" is the exact set of foods+quantities logged together for that meal
 * on a single day; combos are ranked by how many days they recurred,
 * ties broken by most recent occurrence. Returns up to `limit` chips (default 2).
 */
export function computeMealSuggestions(
  history: SuggestionSourceEntry[],
  meal: Meal,
  todayISODate: string,
  windowDays = 14,
  limit = 2
): SuggestionChip[] {
  const cutoff = addDaysISO(todayISODate, -windowDays)

  const byDate = new Map<string, SuggestionEntry[]>()
  for (const e of history) {
    if (e.meal !== meal || !e.foodId) continue
    if (e.date < cutoff || e.date >= todayISODate) continue
    const list = byDate.get(e.date) ?? []
    list.push({
      foodId: e.foodId,
      name: e.name,
      qty: e.qty,
      unit: e.unit,
      grams: e.grams,
      portionLabel: e.portionLabel,
    })
    byDate.set(e.date, list)
  }

  interface ComboStats {
    entries: SuggestionEntry[]
    count: number
    mostRecentDate: string
  }
  const combos = new Map<string, ComboStats>()

  for (const [date, entries] of byDate) {
    if (entries.length === 0) continue
    const sig = comboSignature(entries)
    const existing = combos.get(sig)
    if (existing) {
      existing.count += 1
      if (date > existing.mostRecentDate) existing.mostRecentDate = date
    } else {
      combos.set(sig, { entries, count: 1, mostRecentDate: date })
    }
  }

  return Array.from(combos.entries())
    .map(([key, stats]) => ({ key, stats }))
    .sort((a, b) => {
      if (b.stats.count !== a.stats.count) return b.stats.count - a.stats.count
      return b.stats.mostRecentDate.localeCompare(a.stats.mostRecentDate)
    })
    .slice(0, limit)
    .map(({ key, stats }) => ({ key, label: comboLabel(stats.entries), entries: stats.entries, count: stats.count }))
}
