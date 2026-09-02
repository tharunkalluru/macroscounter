import type { BitewiseDB } from '../../data/db'
import { db as defaultDb } from '../../data/db'
import { SYNCED_TABLES, type SyncedTableName } from '../../domain/sync/types'
import { runSync } from './syncEngine'
import { trackUpsert } from './syncTracker'

export type MigrationRowCounts = Record<SyncedTableName, number>

/**
 * Queues every existing local row across all synced tables into the outbox
 * (via the same `trackUpsert` each repo already calls on a fresh write —
 * migration is just that same call replayed over rows that predate this
 * device being signed in) and pushes them in one `runSync()`. Only called
 * when a newly-signed-in account has no server data yet but this device has
 * pre-existing local usage (guest data being adopted into the account).
 */
export async function migrateLocalToCloud(db: BitewiseDB = defaultDb): Promise<MigrationRowCounts> {
  const rowCounts = {} as MigrationRowCounts

  for (const tableName of SYNCED_TABLES) {
    const table = db.table(tableName)
    const rows = (await table.toArray()) as Record<string, unknown>[]
    rowCounts[tableName] = rows.length
    for (const row of rows) {
      const localId = (row.id as number | undefined) ?? (row.barcode as string)
      await trackUpsert(db, tableName, localId, row)
    }
  }

  await runSync(db)
  return rowCounts
}
