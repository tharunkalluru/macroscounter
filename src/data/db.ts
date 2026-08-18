import Dexie, { type Table } from 'dexie'
import type {
  FoodRecord,
  LogEntry,
  MealTemplate,
  Profile,
  Recipe,
  ScannedProduct,
  Targets,
  WeighIn,
} from './models'

export class MacroDesiDB extends Dexie {
  profiles!: Table<Profile, number>
  targets!: Table<Targets, number>
  foods!: Table<FoodRecord, string>
  recipes!: Table<Recipe, number>
  logEntries!: Table<LogEntry, number>
  weighIns!: Table<WeighIn, number>
  scannedProducts!: Table<ScannedProduct, string>
  mealTemplates!: Table<MealTemplate, number>

  constructor(name = 'macrodesi') {
    super(name)

    // v1 — locked schema (Section 2 of dev-plan-ai-agent.md). Add new tables/indexes
    // in a new .version() block; never edit this one once shipped.
    this.version(1).stores({
      profiles: '++id',
      targets: '++id, effectiveDate',
      foods: 'id, category, name',
      recipes: '++id, name',
      logEntries: '++id, date, meal, [date+meal], foodId, recipeId',
      weighIns: '++id, date',
      scannedProducts: 'barcode',
      mealTemplates: '++id, name',
    })

    // v2 — index `barcode` on logEntries (was an unindexed field added in
    // Phase 5) so "recently scanned" queries can use the index instead of a
    // full table scan. Existing v1 rows carry over untouched — Dexie only
    // adds the new index, it doesn't need to rewrite data since `barcode`
    // was already a plain stored field.
    this.version(2).stores({
      logEntries: '++id, date, meal, [date+meal], foodId, recipeId, barcode',
    })
  }
}

export const db = new MacroDesiDB()
