import type { FoodRecord, Recipe } from '../data/models'
import type { Portion } from '../domain/fooddb/types'
import { sumIngredientGrams } from '../domain/logging/recipeMath'

export type Selected = { kind: 'food'; food: FoodRecord } | { kind: 'recipe'; recipe: Recipe }

export function per100gOf(selected: Selected) {
  return selected.kind === 'food' ? selected.food.per100g : selected.recipe.computedPer100g
}

export function nameOf(selected: Selected) {
  return selected.kind === 'food' ? selected.food.name : selected.recipe.name
}

export function portionsOf(selected: Selected): Portion[] {
  if (selected.kind === 'food') return selected.food.portions
  const totalGrams = sumIngredientGrams(selected.recipe.ingredients)
  const perServing = Math.round((totalGrams / selected.recipe.servings) * 10) / 10
  return [{ label: '1 serving', grams: perServing }]
}
