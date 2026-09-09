import type { FoodRecord, LogEntry } from '../../data/models'

/**
 * Stable id for a logged item with no existing food/recipe reference,
 * derived from its name so repeats (however they were logged — barcode one
 * day, typed the next) converge onto the same reusable record instead of
 * piling up near-duplicates.
 */
export function loggedFoodId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `logged-${slug || 'item'}`
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

type LoggedFoodSource = Pick<
  LogEntry,
  'foodId' | 'recipeId' | 'grams' | 'name' | 'kcal' | 'p' | 'c' | 'f' | 'fiber' | 'portionLabel' | 'portionSummary'
>

/**
 * Turns a just-logged entry into a reusable `FoodRecord` so it shows up in
 * the ordinary search box next time — the app's search is already fuzzy
 * (Fuse.js, see FoodSearchService), so this is what makes "just type and
 * select" work for anything ever logged, regardless of how it was first
 * entered (barcode scan, AI logging, a one-off manual entry).
 *
 * Returns null when there's nothing worth indexing:
 *  - the entry already references an existing food or recipe (`foodId`/
 *    `recipeId` set) — it's already reachable by search, indexing it again
 *    would just be a confusing duplicate of the same item;
 *  - `grams` is 0 — quick-add's fixed-value entries ("Restaurant meal, 600
 *    kcal") have no per-gram basis to scale a reusable portion from, so
 *    treating them as a food would produce a meaningless per-100g figure.
 */
export function deriveLoggedFoodRecord(entry: LoggedFoodSource): FoodRecord | null {
  if (entry.foodId || entry.recipeId) return null
  if (!(entry.grams > 0)) return null
  const name = entry.name.trim()
  if (!name) return null

  const scale = 100 / entry.grams
  return {
    id: loggedFoodId(name),
    name,
    aliases: [],
    category: 'general',
    per100g: {
      kcal: round1(entry.kcal * scale),
      p: round1(entry.p * scale),
      c: round1(entry.c * scale),
      f: round1(entry.f * scale),
      fiber: round1((entry.fiber ?? 0) * scale),
    },
    portions: [{ label: entry.portionLabel || entry.portionSummary || '1 serving', grams: entry.grams }],
    source: 'logged',
    verified: false,
  }
}
