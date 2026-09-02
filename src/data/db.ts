import Dexie, { type Table } from 'dexie'
import type {
  FoodRecord,
  LogEntry,
  MealTemplate,
  Profile,
  Recipe,
  ScannedProduct,
  SyncMetaRow,
  Targets,
  WeighIn,
} from './models'
import type { OutboxEntry } from '../domain/sync/types'

export class BitewiseDB extends Dexie {
  profiles!: Table<Profile, number>
  targets!: Table<Targets, number>
  foods!: Table<FoodRecord, string>
  recipes!: Table<Recipe, number>
  logEntries!: Table<LogEntry, number>
  weighIns!: Table<WeighIn, number>
  scannedProducts!: Table<ScannedProduct, string>
  mealTemplates!: Table<MealTemplate, number>
  syncOutbox!: Table<OutboxEntry, number>
  syncMeta!: Table<SyncMetaRow, number>

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

    // v3 — Phase 10 cloud sync. Adds `clientId` (indexed) to every syncable
    // table so a server pull can look up "do we already have this row"
    // without a full scan; existing rows get a clientId lazily backfilled
    // by `trackUpsert` (src/lib/sync/syncTracker.ts) the first time they're
    // touched, not by this migration, since Dexie's upgrade transaction
    // shouldn't depend on the sync module.
    // `syncOutbox` (pending pushes) and `syncMeta` (single-row: last pull
    // watermark + signed-in user) are new tables, not new indexes on old
    // ones — no data migration needed for those two.
    this.version(3).stores({
      profiles: '++id, clientId',
      targets: '++id, effectiveDate, clientId',
      recipes: '++id, name, clientId',
      logEntries: '++id, date, meal, [date+meal], foodId, recipeId, barcode, clientId',
      weighIns: '++id, date, clientId',
      scannedProducts: 'barcode, clientId',
      mealTemplates: '++id, name, clientId',
      syncOutbox: '++id, [table+clientId]',
      syncMeta: '++id',
    })
  }
}

export const db = new BitewiseDB()
