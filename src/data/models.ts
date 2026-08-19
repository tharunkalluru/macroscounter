import type { FoodCategory, Portion } from '../domain/fooddb/types'
import type { ActivityLevel, Goal, Sex } from '../domain/goals/types'

export type { ActivityLevel, Goal, Sex }
export type TargetSource = 'computed' | 'manual' | 'adaptive'
export type Meal = 'breakfast' | 'lunch' | 'snacks' | 'dinner'
export type Unit = 'portion' | 'grams'

/**
 * Sync bookkeeping shared by every table that syncs to the cloud (Phase 10).
 * `clientId` is the stable identity used across devices and on the server —
 * Dexie's own auto-increment `id` stays purely local. Optional because rows
 * written before Phase 10 (or while signed out) don't have these yet;
 * `trackUpsert` (src/lib/sync/syncTracker.ts) backfills them lazily on
 * first touch rather than via a Dexie migration.
 */
export interface Syncable {
  clientId?: string
  updatedAt?: number
  deletedAt?: number | null
}

export interface Profile extends Syncable {
  id?: number
  name: string
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goal: Goal
}

export interface Targets extends Syncable {
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

export interface Recipe extends Syncable {
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

export interface LogEntry extends Syncable {
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

export interface WeighIn extends Syncable {
  id?: number
  date: string
  weightKg: number
}

export interface ScannedProductMacros {
  kcal: number
  p: number
  c: number
  f: number
  fiber?: number
  sugar?: number
  saturatedFat?: number
  sodium?: number
}

export interface ScannedProduct extends Syncable {
  barcode: string
  name: string
  brand?: string
  imageUrl?: string
  per100g: ScannedProductMacros
  perServing?: ScannedProductMacros
  servingSize?: number
  servingSizeText?: string
  /** The package's total grams, when known (e.g. "2 x 40 g" -> 80) — powers the "1 pack"/"½ pack" chips. */
  quantity?: number
  source: string
  firstScanned: string
}

export interface MealTemplateEntry {
  foodId: string
  qty: number
  unit: Unit
}

export interface MealTemplate extends Syncable {
  id?: number
  name: string
  entries: MealTemplateEntry[]
}

export type SyncStatus = 'signed-out' | 'synced' | 'syncing' | 'offline' | 'error'

/** Single-row table: who's signed in (if anyone) and when we last pulled from the server. */
export interface SyncMetaRow {
  id?: number
  userId: string | null
  userEmail: string | null
  userName: string | null
  userAvatarUrl: string | null
  lastSyncedAt: number | null
}
