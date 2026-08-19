import { doublePrecision, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Server-side mirror of the local Dexie schema (src/data/db.ts), plus `users`.
 * Every synced table's primary key is the SAME uuid the client generates at
 * creation time (see src/lib/sync/clientId.ts) — there is no separate
 * client-id/server-id mapping table, which keeps push/pull idempotent by
 * design (an upsert on `id` is always correct, never a duplicate).
 *
 * `updatedAt` + `deletedAt` on every synced row power last-write-wins
 * conflict resolution and soft-delete propagation (see 10A in
 * phase10-auth-cloud-spec.md). The curated food database (307 items) is
 * static reference data seeded at build time and is deliberately NOT synced
 * here — it's identical for every user.
 */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  googleSub: text('google_sub').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sex: text('sex').notNull(),
  age: integer('age').notNull(),
  heightCm: doublePrecision('height_cm').notNull(),
  weightKg: doublePrecision('weight_kg').notNull(),
  activityLevel: text('activity_level').notNull(),
  goal: text('goal').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const targets = pgTable('targets', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  effectiveDate: text('effective_date').notNull(),
  kcal: doublePrecision('kcal').notNull(),
  proteinG: doublePrecision('protein_g').notNull(),
  carbsG: doublePrecision('carbs_g').notNull(),
  fatG: doublePrecision('fat_g').notNull(),
  source: text('source').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const logEntries = pgTable('log_entries', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  meal: text('meal').notNull(),
  foodId: text('food_id'),
  recipeId: uuid('recipe_id'),
  customSnapshot: jsonb('custom_snapshot'),
  barcode: text('barcode'),
  name: text('name').notNull(),
  portionSummary: text('portion_summary').notNull(),
  portionLabel: text('portion_label'),
  qty: doublePrecision('qty').notNull(),
  unit: text('unit').notNull(),
  grams: doublePrecision('grams').notNull(),
  kcal: doublePrecision('kcal').notNull(),
  p: doublePrecision('p').notNull(),
  c: doublePrecision('c').notNull(),
  f: doublePrecision('f').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const weighIns = pgTable('weigh_ins', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  weightKg: doublePrecision('weight_kg').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ingredients: jsonb('ingredients').notNull(),
  servings: doublePrecision('servings').notNull(),
  computedPer100g: jsonb('computed_per100g').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const mealTemplates = pgTable('meal_templates', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  entries: jsonb('entries').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const scannedProducts = pgTable('scanned_products', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  barcode: text('barcode').notNull(),
  name: text('name').notNull(),
  brand: text('brand'),
  per100g: jsonb('per100g').notNull(),
  perServing: jsonb('per_serving'),
  servingSize: doublePrecision('serving_size'),
  source: text('source').notNull(),
  firstScanned: text('first_scanned').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const SYNCED_TABLES = [
  'profiles',
  'targets',
  'logEntries',
  'weighIns',
  'recipes',
  'mealTemplates',
  'scannedProducts',
] as const

export type SyncedTableName = (typeof SYNCED_TABLES)[number]
