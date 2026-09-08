import type { BitewiseDB } from '../../data/db'
import type { OutboxEntry, SyncedTableName } from '../../domain/sync/types'

export function newClientId(): string {
  return crypto.randomUUID()
}

/** Stamp and coalesce inside one transaction so concurrent tabs cannot lose edits. */
export async function trackUpsert<T extends object>(
  db: BitewiseDB,
  table: SyncedTableName,
  localId: number | string,
  _row: T
): Promise<void> {
  await db.transaction('rw', [db.table(table), db.syncMeta, db.syncOutbox], async () => {
    const meta = await db.syncMeta.toCollection().first()
    if (!meta?.userId) return
    // Re-read: a later edit (or deletion) may have happened before tracking started.
    const current = await db.table(table).get(localId) as Record<string, unknown> | undefined
    if (!current) return
    const clientId = table === 'scannedProducts' ? String(current.barcode) : (current.clientId as string | undefined) ?? newClientId()
    const queued = await db.syncOutbox.where('[table+clientId]').equals([table, clientId]).toArray()
    const updatedAt = Math.max(Date.now(), Number(current.updatedAt ?? 0) + 1, ...queued.map((row) => row.updatedAt + 1))
    const stamped = { ...current, clientId, updatedAt, deletedAt: null }
    await db.table(table).update(localId, { clientId, updatedAt, deletedAt: null })
    await replaceQueued(db, queued, { table, clientId, operation: 'upsert', payload: stamped, updatedAt })
  })
}

/** A deletion remains pending until this exact tombstone has been acknowledged. */
export async function trackDelete(
  db: BitewiseDB,
  table: SyncedTableName,
  clientId: string | undefined,
  previousUpdatedAt = 0
): Promise<void> {
  if (!clientId) return
  await db.transaction('rw', [db.syncMeta, db.syncOutbox], async () => {
    const meta = await db.syncMeta.toCollection().first()
    if (!meta?.userId) return
    const queued = await db.syncOutbox.where('[table+clientId]').equals([table, clientId]).toArray()
    const updatedAt = Math.max(Date.now(), previousUpdatedAt + 1, ...queued.map((row) => row.updatedAt + 1))
    await replaceQueued(db, queued, { table, clientId, operation: 'delete', payload: null, updatedAt })
  })
}

async function replaceQueued(db: BitewiseDB, queued: OutboxEntry[], entry: OutboxEntry): Promise<void> {
  // Also repairs duplicate pending rows left by older clients' non-atomic writes.
  if (queued.length > 0) await db.syncOutbox.bulkDelete(queued.map((row) => row.id!))
  await db.syncOutbox.put({ ...entry, ...(queued[0]?.id !== undefined ? { id: queued[0].id } : {}) })
}
