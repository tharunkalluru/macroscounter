import { boolean, doublePrecision, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Server-side mirror of the local Dexie schema (src/data/db.ts), plus Better
 * Auth's own `user`/`session`/`account`/`verification` tables (Phase 10.2 —
 * Google sign-in). Better Auth owns the shape of those four tables and
 * generates string ids for them (not uuid), so every synced row's `userId`
 * FK below is `text`, referencing `user.id` — not the `uuid` type used by
 * the row's own `id`.
 *
 * Every synced table's primary key is the SAME uuid the client generates at
 * creation time (see src/lib/sync/syncTracker.ts) — there is no separate
 * client-id/server-id mapping table, which keeps push/pull idempotent by
 * design (an upsert on `id` is always correct, never a duplicate).
 *
 * `updatedAt` + `deletedAt` on every synced row power last-write-wins
 * conflict resolution and soft-delete propagation (see 10A in
 * phase10-auth-cloud-spec.md). The curated food database (307 items) is
 * static reference data seeded at build time and is deliberately NOT synced
 * here — it's identical for every user.
 */

// --- Better Auth core schema (Google-only social provider, no email/password) ---

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

// `accountId` is the provider's own user id — Google's `sub` claim — for a
// row with `providerId = 'google'`. This replaces what the original 10.1
// draft schema called `users.googleSub`.
export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  // Better Auth 1.7+ requires this to disambiguate accounts across OIDC
  // issuers under the same providerId. For our Google-only OAuth setup it's
  // always Better Auth's synthetic `local:oauth:google` (see
  // createOAuthAccountIssuer in @better-auth/core's account schema) — never
  // the literal https://accounts.google.com issuer URL, since that's only
  // used for id_token verification, not account lookup.
  issuer: text('issuer').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const authSchema = { user, session, account, verification }

// --- App data (Phase 10.1), synced per signed-in user ---

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sex: text('sex').notNull(),
  age: integer('age').notNull(),
  heightCm: doublePrecision('height_cm').notNull(),
  weightKg: doublePrecision('weight_kg').notNull(),
  activityLevel: text('activity_level').notNull(),
  goal: text('goal').notNull(),
  // Display/input preference only (heightCm/weightKg above stay canonical
  // metric) -- defaulted so this ADD COLUMN is safe against the
  // already-populated production table; existing rows read as 'cm'/'kg'.
  heightUnit: text('height_unit').notNull().default('cm'),
  weightUnit: text('weight_unit').notNull().default('kg'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const targets = pgTable('targets', {
  id: uuid('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
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
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  weightKg: doublePrecision('weight_kg').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const recipes = pgTable('recipes', {
  id: uuid('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  ingredients: jsonb('ingredients').notNull(),
  servings: doublePrecision('servings').notNull(),
  computedPer100g: jsonb('computed_per100g').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const mealTemplates = pgTable('meal_templates', {
  id: uuid('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  entries: jsonb('entries').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export const scannedProducts = pgTable('scanned_products', {
  // text, not uuid: the client deliberately uses the barcode itself as this
  // row's clientId/id (see ScannedProductRepo.put) so two devices scanning
  // the same product converge on one row instead of two -- a barcode is
  // never a valid uuid, so this column must accept arbitrary text.
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  barcode: text('barcode').notNull(),
  name: text('name').notNull(),
  brand: text('brand'),
  imageUrl: text('image_url'),
  per100g: jsonb('per100g').notNull(),
  perServing: jsonb('per_serving'),
  servingSize: doublePrecision('serving_size'),
  servingSizeText: text('serving_size_text'),
  quantity: doublePrecision('quantity'),
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
