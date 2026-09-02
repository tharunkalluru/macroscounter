import type { BitewiseDB } from '../../data/db'
import { enqueueMutation } from '../../domain/sync/outbox'
import type { OutboxEntry, SyncedTableName } from '../../domain/sync/types'

export function newClientId(): string {
  return crypto.randomUUID()
}

/**
 * Call this right after a syncable row is written locally (add or update).
 * Stamps `clientId` (generating one on first write) and `updatedAt`, persists
 * those stamps back onto the row, and queues the mutation in the outbox for
 * the next push. A no-op for guest (signed-out) users — there's nothing to
 * sync until they sign in, and the outbox would just grow unbounded.
 *
 * Takes the same `BitewiseDB` instance the calling repo was constructed
 * with (not a module-level singleton), so repos stay testable against an
 * isolated, per-test database exactly as before.
 */
export async function trackUpsert<T extends object>(
  db: BitewiseDB,
  table: SyncedTableName,
  localId: number | string,
  row: T
): Promise<void> {
  if (!(await isSignedIn(db))) return

  const record = row as Record<string, unknown>
  const now = Date.now()
  const clientId = (record.clientId as string | undefined) ?? newClientId()
  const stamped = { ...record, clientId, updatedAt: now, deletedAt: null }

  await (db.table(table) as unknown as { update: (id: unknown, changes: unknown) => Promise<number> }).update(
    localId,
    { clientId, updatedAt: now }
  )

  const outbox = await db.syncOutbox.toArray()
  const next = enqueueMutation(outbox, { table, clientId, operation: 'upsert', payload: stamped, updatedAt: now })
  await writeOutbox(db, outbox, next)
}

/** Call right after a syncable row is deleted locally. Queues a tombstone for the next push. */
export async function trackDelete(
  db: BitewiseDB,
  table: SyncedTableName,
  clientId: string | undefined
): Promise<void> {
  if (!clientId) return // never synced (e.g. created while signed out) — nothing to tell the server
  if (!(await isSignedIn(db))) return

  const now = Date.now()
  const outbox = await db.syncOutbox.toArray()
  const next = enqueueMutation(outbox, { table, clientId, operation: 'delete', payload: null, updatedAt: now })
  await writeOutbox(db, outbox, next)
}

async function isSignedIn(db: BitewiseDB): Promise<boolean> {
  const meta = await db.syncMeta.toCollection().first()
  return !!meta?.userId
}

async function writeOutbox(db: BitewiseDB, previous: OutboxEntry[], next: OutboxEntry[]): Promise<void> {
  const previousIds = new Set(previous.map((e) => e.id))
  for (const entry of next) {
    if (entry.id !== undefined && previousIds.has(entry.id)) {
      await db.syncOutbox.update(entry.id, entry)
    } else {
      const id = await db.syncOutbox.add(entry)
      entry.id = id
    }
  }
}
