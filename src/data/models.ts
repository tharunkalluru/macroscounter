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
  /** Display/input preference only — heightCm/weightKg above stay canonical metric regardless. Optional: absent on profiles written before this field existed, treated the same as 'cm'/'kg'. */
  heightUnit?: 'cm' | 'ft_in'
  weightUnit?: 'kg' | 'lb'
  /** Optional target weight (canonical kg) powering the "goal ETA" projection on Trends. Absent = feature not opted into. */
  goalWeightKg?: number
  /** ISO yyyy-mm-dd, collected at onboarding for a nicer input than a bare age field. `age` above stays the authoritative engine input either way. */
  dateOfBirth?: string
  /** Self-reported body-fat %, from a skippable onboarding picker. Stored only — does not feed calculateBMR (Mifflin-St Jeor, not Katch-McArdle). */
  bodyFatPercent?: number
  /** Informational only — collected at onboarding, not read by any engine or UI logic yet. */
  weightHistoryClass?: 'first_time' | 'some_success' | 'yo_yo' | 'long_term_maintainer'
  /** Onboarding diet-style preference. 'balanced' (default) matches pre-R.2 behavior (fatGPerKg omitted). */
  dietStyle?: 'balanced' | 'higher_fat' | 'lower_carb'
  /** Onboarding protein-priority preference. 'standard' (default) matches pre-R.2 behavior (proteinGPerKg omitted). */
  proteinPriority?: 'standard' | 'high' | 'very_high'
  /** Onboarding calorie-floor preference. 'standard' (default) matches pre-R.2 behavior (no floor buffer). */
  calorieFloorChoice?: 'standard' | 'gentler'
  /** Desired rate of weight change (lb/week) chosen at onboarding, feeding goalEngine's goalRateLbPerWeek. Absent for profiles created before Phase R.2. */
  goalRateLbPerWeek?: number
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
  /**
   * The account this device's local synced tables currently belong to.
   * Unlike `userId` (cleared on sign-out), this persists across sign-out so
   * a later sign-in can tell "the same person came back" from "a different
   * account is signing in on data that isn't theirs" — see
   * `resolveAfterSignIn`. Optional because rows written before this field
   * existed won't have it; treat missing the same as `null` (no prior link).
   */
  linkedUserId?: string | null
}
