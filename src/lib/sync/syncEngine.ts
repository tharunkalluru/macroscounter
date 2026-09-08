import type { BitewiseDB } from '../../data/db'
import { db as defaultDb } from '../../data/db'
import { reconcileAfterPush } from '../../domain/sync/outbox'
import { SYNCED_TABLES, type SyncRow, type SyncedTableName } from '../../domain/sync/types'

export type SyncStatus = 'signed-out' | 'synced' | 'syncing' | 'offline' | 'error'

/** Clock-skew tolerance re-pulled on every sync (see runSync's watermark). */
const PULL_OVERLAP_MS = 5 * 60 * 1000

type Listener = (status: SyncStatus) => void
const listeners = new Set<Listener>()
let currentStatus: SyncStatus = 'signed-out'
let syncing = false

function setStatus(status: SyncStatus) {
  currentStatus = status
  listeners.forEach((fn) => fn(status))
}

export function getSyncStatus(): SyncStatus {
  return currentStatus
}

export function onSyncStatusChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Fires when a pull actually wrote rows into local tables. Without this a
 * background pull lands in IndexedDB but nothing on screen re-reads it, so
 * a second device would show stale numbers until the user navigated.
 */
const dataListeners = new Set<() => void>()

export function onSyncDataChanged(listener: () => void): () => void {
  dataListeners.add(listener)
  return () => dataListeners.delete(listener)
}

async function getMeta(db: BitewiseDB) {
  return db.syncMeta.toCollection().first()
}

/**
 * Pushes the outbox, then pulls everything the server has changed since our
 * last sync, merging pulled rows into local tables with last-write-wins.
 * Safe to call opportunistically (app open, regaining connectivity, after
 * each log) — it no-ops for guests and is not reentrant.
 */
export async function runSync(db: BitewiseDB = defaultDb): Promise<void> {
  if (syncing) return
  const meta = await getMeta(db)
  if (!meta?.userId) {
    setStatus('signed-out')
    return
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setStatus('offline')
    return
  }

  syncing = true
  setStatus('syncing')
  try {
    await pushOutbox(db)
    const pulledAt = await pullChanges(db, meta.lastSyncedAt ?? 0)
    // Watermark the *server's* clock, not this device's, and rewind it by a
    // safety window before storing. Rows are stamped with whichever device
    // wrote them, so with a hairline watermark a second device whose clock
    // runs a little behind can write rows stamped earlier than our last
    // sync and never be pulled at all. Re-pulling a few minutes of overlap
    // is free -- the merge is idempotent last-write-wins.
    const nextWatermark = Math.max(0, (pulledAt ?? Date.now()) - PULL_OVERLAP_MS)
    await db.syncMeta.update(meta.id!, { lastSyncedAt: nextWatermark })
    setStatus('synced')
  } catch {
    setStatus('error')
  } finally {
    syncing = false
  }
}

async function pushOutbox(db: BitewiseDB): Promise<void> {
  const outbox = await db.syncOutbox.toArray()
  if (outbox.length === 0) return

  const res = await fetch('/api/sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      mutations: outbox.map((e) => ({
        table: e.table,
        clientId: e.clientId,
        operation: e.operation,
        payload: e.payload,
        updatedAt: e.updatedAt,
      })),
    }),
  })
  if (!res.ok) throw new Error(`push failed: ${res.status}`)

  const { flushed } = (await res.json()) as {
    flushed: { table: string; clientId: string; updatedAt: number }[]
  }
  const remaining = reconcileAfterPush(outbox, flushed)
  const flushedIds = new Set(outbox.filter((e) => !remaining.includes(e)).map((e) => e.id))
  for (const id of flushedIds) {
    if (id !== undefined) await db.syncOutbox.delete(id)
  }
}

/**
 * Raw, unmerged pull used only to answer "does this account already have a
 * profile on the server?" (see resolveAfterSignIn's pull-vs-migrate branch)
 * — deliberately doesn't touch local tables, since a normal `runSync()`
 * pull is what actually merges data down once that decision is made.
 */
export async function serverHasProfile(): Promise<boolean> {
  const res = await fetch('/api/sync/pull?since=0', { credentials: 'include' })
  if (!res.ok) throw new Error(`pull failed: ${res.status}`)
  const { tables } = (await res.json()) as { tables: Record<string, SyncRow[]> }
  return (tables.profiles?.length ?? 0) > 0
}

async function pullChanges(db: BitewiseDB, since: number): Promise<number | undefined> {
  const res = await fetch(`/api/sync/pull?since=${since}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`pull failed: ${res.status}`)

  const { tables, pulledAt } = (await res.json()) as {
    tables: Record<string, SyncRow[]>
    pulledAt?: number
  }

  let writes = 0
  for (const tableName of SYNCED_TABLES) {
    const remoteRows = tables[tableName] ?? []
    if (remoteRows.length === 0) continue
    writes += await mergeTable(db, tableName, remoteRows)
  }
  if (writes > 0) dataListeners.forEach((fn) => fn())

  return pulledAt
}

/**
 * Strips the fields that belong to the *server's* copy of a row before it's
 * written locally. `id` on the wire is the Postgres primary key (the row's
 * uuid); every local table except `scannedProducts` keys off an
 * auto-incrementing number instead. Writing the uuid straight through -- the
 * previous behavior -- silently replaced the local numeric primary key with a
 * string, so anything addressing a row by its local id afterwards (editing or
 * deleting an entry, `ProfileRepo.save`'s update-by-id) quietly stopped
 * matching. `userId` is likewise server bookkeeping with no local column.
 */
function toLocalRow(row: SyncRow): Record<string, unknown> {
  const { id: _serverId, userId: _userId, ...rest } = row as Record<string, unknown>
  return rest
}

/**
 * Applies one table's worth of pulled rows, returning how many local rows
 * actually changed.
 *
 * Only rows the server has genuinely newer copies of are written. The
 * previous version iterated `mergeRemoteRows`'s output, which is *every*
 * local row (remote winners merged over the full local set) — so each pull
 * rewrote the entire table, and there was no way to tell whether anything
 * had really changed. That matters now that a real change notifies the UI:
 * an unconditional rewrite would report "changed" on every pull and spin
 * pull → notify → pull forever.
 *
 * The comparison is strictly newer rather than `resolveLWW`'s newer-or-equal
 * for the same reason: pulls deliberately overlap (see PULL_OVERLAP_MS), so
 * the same unchanged rows come back every time and must be recognised as
 * no-ops. The only behavior this gives up is the tie-break for two devices
 * writing the same row in the same millisecond, where local now stays put.
 */
async function mergeTable(
  db: BitewiseDB,
  tableName: SyncedTableName,
  remoteRows: SyncRow[]
): Promise<number> {
  const table = db.table(tableName)
  const localRows = (await table.toArray()) as unknown as SyncRow[]
  const localByClientId = new Map(localRows.map((row) => [row.clientId, row]))
  let writes = 0

  for (const remote of remoteRows) {
    const local = localByClientId.get(remote.clientId)
    if (local && remote.updatedAt <= local.updatedAt) continue

    const localKey = (local as unknown as { id?: number; barcode?: string } | undefined)?.id

    if (remote.deletedAt) {
      if (local) {
        await table.delete(localKey ?? (remote.barcode as string))
        writes++
      }
      continue
    }

    if (local) {
      await table.update(localKey ?? (remote.barcode as string), toLocalRow(remote) as never)
    } else if (tableName === 'scannedProducts') {
      await table.put(toLocalRow(remote) as never)
    } else {
      await table.add(toLocalRow(remote) as never)
    }
    writes++
  }
  return writes
}
