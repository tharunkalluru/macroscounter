import type { LogEntry, Meal, MealTemplateSnapshot, Unit } from '../../data/models'
import { addDaysISO } from '../../lib/date'

export type SuggestionSourceEntry = Pick<LogEntry, 'date' | 'meal' | 'name' | 'qty' | 'unit' | 'grams'> & Partial<LogEntry>
export interface SuggestionEntry {
  foodId?: string
  name: string
  qty: number
  unit: Unit
  grams: number
  portionLabel?: string
  snapshot?: MealTemplateSnapshot
}
export interface SuggestionChip {
  key: string
  label: string
  entries: SuggestionEntry[]
  count: number
  lastLoggedDate?: string
}

function toSuggestion(entry: SuggestionSourceEntry): SuggestionEntry | null {
  const hasNutrition = [entry.kcal, entry.p, entry.c, entry.f].every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
  if (!hasNutrition && !entry.foodId) return null
  const snapshot: MealTemplateSnapshot | undefined = hasNutrition ? {
    foodId: entry.foodId,
    barcode: entry.barcode,
    customSnapshot: entry.customSnapshot ? { ...entry.customSnapshot } : undefined,
    name: entry.name,
    portionSummary: entry.portionSummary ?? `${entry.grams} g`,
    portionLabel: entry.portionLabel,
    qty: entry.qty,
    unit: entry.unit,
    grams: entry.grams,
    kcal: entry.kcal!, p: entry.p!, c: entry.c!, f: entry.f!, fiber: entry.fiber,
  } : undefined
  return { foodId: entry.foodId, name: entry.name, qty: entry.qty, unit: entry.unit, grams: entry.grams, portionLabel: entry.portionLabel, snapshot }
}

function comboSignature(entries: SuggestionEntry[]): string {
  return entries.map((entry) => JSON.stringify([
    entry.foodId ?? entry.name, entry.qty, entry.unit, entry.grams, entry.portionLabel ?? '',
    entry.snapshot?.kcal, entry.snapshot?.p, entry.snapshot?.c, entry.snapshot?.f, entry.snapshot?.fiber,
  ])).sort().join('|')
}

/** Historical meals retain their recorded portions and nutrition, including AI and custom foods. */
export function computeMealSuggestions(
  history: SuggestionSourceEntry[],
  meal: Meal,
  todayISODate: string,
  windowDays = 14,
  limit = 2
): SuggestionChip[] {
  const cutoff = addDaysISO(todayISODate, -windowDays)
  const byDate = new Map<string, SuggestionEntry[]>()
  const incompleteDates = new Set<string>()
  for (const entry of history) {
    if (entry.meal !== meal || entry.date < cutoff || entry.date >= todayISODate) continue
    const suggestion = toSuggestion(entry)
    if (!suggestion) { incompleteDates.add(entry.date); continue }
    const list = byDate.get(entry.date) ?? []
    list.push(suggestion)
    byDate.set(entry.date, list)
  }
  const combos = new Map<string, SuggestionChip>()
  for (const [date, entries] of byDate) {
    // Never silently suggest only part of a meal that cannot be replayed.
    if (incompleteDates.has(date)) continue
    const key = comboSignature(entries)
    const existing = combos.get(key)
    if (existing) {
      existing.count += 1
      if (date > (existing.lastLoggedDate ?? '')) existing.lastLoggedDate = date
    } else {
      combos.set(key, { key, label: entries.map((e) => e.qty > 1 && e.unit === 'portion' ? `${e.qty} ${e.name}` : e.name).join(' + '), entries, count: 1, lastLoggedDate: date })
    }
  }
  return [...combos.values()].sort((a, b) => b.count - a.count || (b.lastLoggedDate ?? '').localeCompare(a.lastLoggedDate ?? '')).slice(0, limit)
}
