import type { FoodCategory, Portion } from '../domain/fooddb/types'
import type { ActivityLevel, Goal, Sex } from '../domain/goals/types'

export type { ActivityLevel, Goal, Sex }
export type TargetSource = 'computed' | 'manual' | 'adaptive'
export type Meal = 'breakfast' | 'lunch' | 'snacks' | 'dinner'
export type Unit = 'portion' | 'grams'

export interface Profile {
  id?: number
  name: string
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goal: Goal
}

export interface Targets {
  id?: number
  effectiveDate: string
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  source: TargetSource
}

export interface FoodRecord {
  id: string
  name: string
  aliases: string[]
  category: FoodCategory
  per100g: { kcal: number; p: number; c: number; f: number; fiber: number }
  portions: Portion[]
  source: string
  verified: boolean
  favorite?: boolean
}

export interface RecipeIngredient {
  foodId: string
  grams: number
}

export interface Recipe {
  id?: number
  name: string
  ingredients: RecipeIngredient[]
  servings: number
  computedPer100g: { kcal: number; p: number; c: number; f: number }
}

export interface CustomSnapshot {
  name: string
  kcal: number
  p: number
  c: number
  f: number
}

export interface LogEntry {
  id?: number
  date: string
  meal: Meal
  foodId?: string
  recipeId?: number
  customSnapshot?: CustomSnapshot
  /** Set when this entry came from a barcode scan (see `scannedProducts`). */
  barcode?: string
  /** Denormalized display name (food/recipe/custom name) at time of logging. */
  name: string
  /** Denormalized human-readable portion, e.g. "3 x 1 idli" or "120 g". */
  portionSummary: string
  /** The raw picked portion's label (e.g. "1 idli"), when `unit === 'portion'`. Powers `formatPortion()`; absent for grams-mode and custom entries. */
  portionLabel?: string
  qty: number
  unit: Unit
  grams: number
  kcal: number
  p: number
  c: number
  f: number
}

export interface WeighIn {
  id?: number
  date: string
  weightKg: number
}

export interface ScannedProduct {
  barcode: string
  name: string
  brand?: string
  per100g: { kcal: number; p: number; c: number; f: number }
  perServing?: { kcal: number; p: number; c: number; f: number }
  servingSize?: number
  source: string
  firstScanned: string
}

export interface MealTemplateEntry {
  foodId: string
  qty: number
  unit: Unit
}

export interface MealTemplate {
  id?: number
  name: string
  entries: MealTemplateEntry[]
}
