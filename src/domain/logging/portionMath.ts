import type { Meal } from '../../data/models'

export interface MacroTotals {
  kcal: number
  p: number
  c: number
  f: number
  /** Grams of dietary fiber. Optional -- entries/sources predating fiber tracking have none. */
  fiber?: number
}

export interface Per100g {
  kcal: number
  p: number
  c: number
  f: number
  fiber?: number
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Total grams for a portion-unit entry: qty portions of a given gram size. */
export function gramsForPortion(qty: number, portionGrams: number): number {
  return qty * portionGrams
}

/** Denormalized macro totals for `grams` of a food/recipe with the given per-100g profile. */
export function computeMacrosForGrams(per100g: Per100g, grams: number): MacroTotals {
  const factor = grams / 100
  return {
    kcal: round1(per100g.kcal * factor),
    p: round1(per100g.p * factor),
    c: round1(per100g.c * factor),
    f: round1(per100g.f * factor),
    fiber: per100g.fiber !== undefined ? round1(per100g.fiber * factor) : undefined,
  }
}

/**
 * Scales a source's own declared per-serving macros by a serving count.
 * Preferred over `computeMacrosForGrams` for a scanned product's serving
 * portion when the source (e.g. Open Food Facts) provides per-serving
 * values directly — those are the manufacturer's own rounded label figures,
 * which can drift slightly from per100g x servingGrams recomputed locally.
 */
export function computeMacrosForServings(perServing: MacroTotals, servings: number): MacroTotals {
  return {
    kcal: round1(perServing.kcal * servings),
    p: round1(perServing.p * servings),
    c: round1(perServing.c * servings),
    f: round1(perServing.f * servings),
    fiber: perServing.fiber !== undefined ? round1(perServing.fiber * servings) : undefined,
  }
}

export function sumMacros(entries: MacroTotals[]): MacroTotals {
  return entries.reduce(
    (acc, e) => ({
      kcal: round1(acc.kcal + e.kcal),
      p: round1(acc.p + e.p),
      c: round1(acc.c + e.c),
      f: round1(acc.f + e.f),
      fiber: round1((acc.fiber ?? 0) + (e.fiber ?? 0)),
    }),
    { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 }
  )
}

export function sumMacrosByMeal<T extends MacroTotals & { meal: Meal }>(
  entries: T[]
): Record<Meal, MacroTotals> {
  const meals: Meal[] = ['breakfast', 'lunch', 'snacks', 'dinner']
  const result = {} as Record<Meal, MacroTotals>
  for (const meal of meals) {
    result[meal] = sumMacros(entries.filter((e) => e.meal === meal))
  }
  return result
}
