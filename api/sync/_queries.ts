import { getTableColumns, sql, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { schema } from '../_db.js'
import type { ValidMutation } from './_validation.js'

export const TABLES = {
  profiles: schema.profiles, targets: schema.targets, logEntries: schema.logEntries,
  weighIns: schema.weighIns, recipes: schema.recipes, mealTemplates: schema.mealTemplates,
  scannedProducts: schema.scannedProducts,
} as const

/** One transaction serializes writes for a single account, while other accounts remain independent. */
export function accountWriteLock(userId: string): SQL {
  return sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`
}

/**
 * Both conflict predicates live in SQL. A tenant-filtered preflight SELECT is
 * insufficient: another writer may change the row before the INSERT occurs.
 */
export function mutationQueries(userId: string, mutation: ValidMutation): SQL[] {
  const table = TABLES[mutation.table]
  const tombstones = schema.syncTombstones
  const timestamp = new Date(mutation.updatedAt).toISOString()
  const tombstoneId = `${mutation.table}:${mutation.clientId}`
  if (mutation.operation === 'delete') {
    return [
      sql`insert into ${tombstones} (id, user_id, table_name, client_id, updated_at, server_changed_at)
        values (${tombstoneId}, ${userId}, ${mutation.table}, ${mutation.clientId}, ${timestamp}::timestamptz, clock_timestamp())
        on conflict (user_id, id) do update set updated_at = excluded.updated_at, server_changed_at = clock_timestamp()
        where ${tombstones.updatedAt} < excluded.updated_at`,
      sql`update ${table} set deleted_at = ${timestamp}::timestamptz, updated_at = ${timestamp}::timestamptz,
        server_changed_at = clock_timestamp()
        where ${table.id} = ${mutation.clientId} and ${table.userId} = ${userId}
          and ${table.updatedAt} <= ${timestamp}::timestamptz`,
    ]
  }

  const columns = getTableColumns(table) as Record<string, PgColumn>
  // Payload validation strips all client-supplied bookkeeping and unknown fields.
  const row: Record<string, unknown> = {
    ...mutation.payload, id: mutation.clientId, userId,
    updatedAt: new Date(mutation.updatedAt), deletedAt: null,
  }
  const entries = Object.entries(row).filter(([key, value]) => columns[key] && value !== undefined)
  const columnNames = entries.map(([key]) => sql.identifier(columns[key].name))
  const values = entries.map(([key, value]) => sql`${sql.param(value, columns[key])}`)
  const updates = entries.filter(([key]) => key !== 'id' && key !== 'userId')
    .map(([key]) => sql`${sql.identifier(columns[key].name)} = excluded.${sql.identifier(columns[key].name)}`)
  const conflict = mutation.table === 'scannedProducts' ? sql`(user_id, id)` : sql`(id)`
  return [sql`insert into ${table} (${sql.join(columnNames, sql`, `)}, server_changed_at)
    select ${sql.join(values, sql`, `)}, clock_timestamp()
    where not exists (select 1 from ${tombstones}
      where ${tombstones.userId} = ${userId} and ${tombstones.id} = ${tombstoneId}
        and ${tombstones.updatedAt} >= ${timestamp}::timestamptz)
    on conflict ${conflict} do update set ${sql.join(updates, sql`, `)}, server_changed_at = clock_timestamp()
    where ${table.userId} = ${userId} and ${table.updatedAt} < excluded.updated_at`]
}
