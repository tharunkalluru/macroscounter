import type { Meal } from '../../data/models'

export interface MacroTotals {
  kcal: number
  p: number
  c: number
  f: number
}

export interface Per100g {
  kcal: number
  p: number
  c: number
  f: number
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
  }
}

export function sumMacros(entries: MacroTotals[]): MacroTotals {
  return entries.reduce(
    (acc, e) => ({
      kcal: round1(acc.kcal + e.kcal),
      p: round1(acc.p + e.p),
      c: round1(acc.c + e.c),
      f: round1(acc.f + e.f),
    }),
    { kcal: 0, p: 0, c: 0, f: 0 }
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
