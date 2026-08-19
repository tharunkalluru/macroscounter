import type { MacroDesiDB } from '../../data/db'
import { db as defaultDb } from '../../data/db'
import { mergeRemoteRows } from '../../domain/sync/lww'
import { reconcileAfterPush } from '../../domain/sync/outbox'
import { SYNCED_TABLES, type SyncRow, type SyncedTableName } from '../../domain/sync/types'

export type SyncStatus = 'signed-out' | 'synced' | 'syncing' | 'offline' | 'error'

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

async function getMeta(db: MacroDesiDB) {
  return db.syncMeta.toCollection().first()
}

/**
 * Pushes the outbox, then pulls everything the server has changed since our
 * last sync, merging pulled rows into local tables with last-write-wins.
 * Safe to call opportunistically (app open, regaining connectivity, after
 * each log) — it no-ops for guests and is not reentrant.
 */
export async function runSync(db: MacroDesiDB = defaultDb): Promise<void> {
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
    await pullChanges(db, meta.lastSyncedAt ?? 0)
    await db.syncMeta.update(meta.id!, { lastSyncedAt: Date.now() })
    setStatus('synced')
  } catch {
    setStatus('error')
  } finally {
    syncing = false
  }
}

async function pushOutbox(db: MacroDesiDB): Promise<void> {
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

async function pullChanges(db: MacroDesiDB, since: number): Promise<void> {
  const res = await fetch(`/api/sync/pull?since=${since}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`pull failed: ${res.status}`)

  const { tables } = (await res.json()) as { tables: Record<string, SyncRow[]> }

  for (const tableName of SYNCED_TABLES) {
    const remoteRows = tables[tableName] ?? []
    if (remoteRows.length === 0) continue
    await mergeTable(db, tableName, remoteRows)
  }
}

async function mergeTable(db: MacroDesiDB, tableName: SyncedTableName, remoteRows: SyncRow[]): Promise<void> {
  const table = db.table(tableName)
  const localRows = (await table.toArray()) as unknown as SyncRow[]
  const merged = mergeRemoteRows(localRows, remoteRows)
  const localByClientId = new Map(localRows.map((row) => [row.clientId, row]))

  for (const row of merged) {
    const local = localByClientId.get(row.clientId)
    if (row.deletedAt) {
      if (local) await table.delete((local as unknown as { id?: number; barcode?: string }).id ?? row.barcode as string)
      continue
    }
    if (local) {
      const localId = (local as unknown as { id?: number; barcode?: string }).id
      await table.update(localId ?? (row.barcode as string), row as never)
    } else if (tableName === 'scannedProducts') {
      await table.put(row as never)
    } else {
      const { clientId: _c, ...rest } = row
      await table.add({ ...rest, clientId: row.clientId } as never)
    }
  }
}
