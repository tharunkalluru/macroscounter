import type { Meal } from '../../data/models'

const MEAL_ORDER: Meal[] = ['breakfast', 'lunch', 'snacks', 'dinner']

export interface MealBreakdownRow {
  meal: Meal
  grams: number
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Per-meal totals for one macro (protein/carbs/fat), in meal order, for the per-meal breakdown sheet. */
export function computeMacroBreakdown<T extends { meal: Meal; p: number; c: number; f: number }>(
  entries: T[],
  macro: 'p' | 'c' | 'f'
): MealBreakdownRow[] {
  return MEAL_ORDER.map((meal) => ({
    meal,
    grams: round1(entries.filter((e) => e.meal === meal).reduce((sum, e) => sum + e[macro], 0)),
  }))
}
