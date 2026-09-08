import type { BitewiseDB } from '../../data/db'
import { db as defaultDb } from '../../data/db'
import { SYNCED_TABLES, type OutboxEntry, type SyncRow, type SyncedTableName } from '../../domain/sync/types'

export type SyncStatus = 'signed-out' | 'synced' | 'syncing' | 'offline' | 'error'
const PULL_OVERLAP_MS = 5 * 60 * 1000
const PUSH_BATCH_SIZE = 100
const PUSH_BATCH_BYTES = 900_000
const listeners = new Set<(status: SyncStatus) => void>()
const dataListeners = new Set<() => void>()
let currentStatus: SyncStatus = 'signed-out'
let currentError: string | null = null

type SyncState = { active?: Promise<SyncStatus>; rerun: boolean; epoch: number; paused: number }
const states = new WeakMap<BitewiseDB, SyncState>()
function stateFor(db: BitewiseDB): SyncState {
  let state = states.get(db)
  if (!state) {
    state = { rerun: false, epoch: 0, paused: 0 }
    states.set(db, state)
  }
  return state
}

function setStatus(status: SyncStatus, error: string | null = null) {
  currentStatus = status
  currentError = error
  listeners.forEach((fn) => fn(status))
}
export function getSyncStatus(): SyncStatus { return currentStatus }
export function getSyncError(): string | null { return currentError }
export function onSyncStatusChange(listener: (status: SyncStatus) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export function onSyncDataChanged(listener: () => void): () => void {
  dataListeners.add(listener)
  return () => dataListeners.delete(listener)
}

/** Fence outstanding responses before changing accounts or clearing private rows. */
export async function withSyncPaused<T>(db: BitewiseDB, action: () => Promise<T>): Promise<T> {
  const state = stateFor(db)
  state.paused++
  state.epoch++
  try {
    await state.active
    return await action()
  } finally {
    state.paused--
    const meta = await db.syncMeta.toCollection().first()
    if (!meta?.userId) setStatus('signed-out')
  }
}

class AccountChangedError extends Error {}
async function assertAccount(db: BitewiseDB, userId: string, epoch: number): Promise<void> {
  const meta = await db.syncMeta.toCollection().first()
  if (stateFor(db).epoch !== epoch || meta?.userId !== userId) throw new AccountChangedError()
}

/** Coalesces overlapping triggers, including writes made during an in-flight request. */
export function runSync(db: BitewiseDB = defaultDb): Promise<SyncStatus> {
  const state = stateFor(db)
  if (state.paused) return Promise.resolve(currentStatus)
  if (state.active) {
    state.rerun = true
    return state.active
  }
  state.active = Promise.resolve().then(async () => {
    let result: SyncStatus = currentStatus
    do {
      state.rerun = false
      result = await syncOnce(db, state.epoch)
    } while (state.rerun && !state.paused && result === 'synced')
    return result
  }).finally(() => { state.active = undefined })
  return state.active
}

async function syncOnce(db: BitewiseDB, epoch: number): Promise<SyncStatus> {
  try {
    const meta = await db.syncMeta.toCollection().first()
    if (!meta?.userId) { setStatus('signed-out'); return 'signed-out' }
    if (typeof navigator !== 'undefined' && !navigator.onLine) { setStatus('offline'); return 'offline' }
    setStatus('syncing')
    const pushError = await pushOutbox(db, meta.userId, epoch)
    const pulledAt = await pullChanges(db, meta.userId, meta.lastSyncedAt ?? 0, epoch)
    let pendingCount = 0
    await db.transaction('rw', [db.syncMeta, db.syncOutbox], async () => {
      await assertAccount(db, meta.userId!, epoch)
      if (pulledAt !== undefined) {
        await db.syncMeta.update(meta.id!, { lastSyncedAt: Math.max(0, pulledAt - PULL_OVERLAP_MS) })
      }
      if (pushError) throw new Error(pushError)
      pendingCount = await db.syncOutbox.count()
      if (pendingCount > 0) {
        // These are edits made while a request was in flight. The next cycle pushes them.
        stateFor(db).rerun = true
      }
    })
    if (pendingCount === 0) setStatus('synced')
    return 'synced'
  } catch (error) {
    if (error instanceof AccountChangedError && stateFor(db).epoch !== epoch) return currentStatus
    if (error instanceof AccountChangedError) {
      setStatus('error', 'The account changed. Sign in again to continue safely.')
      return 'error'
    }
    const message = error instanceof Error ? error.message : 'Your changes are saved on this device. Try syncing again.'
    setStatus('error', message)
    return 'error'
  }
}

async function fetchSync(url: string, userId: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(url, {
      ...init, credentials: 'include', signal: controller.signal,
      headers: { ...init.headers, 'X-Sync-User-Id': userId },
    })
    if (!res.ok) {
      if (res.status === 401 || res.status === 409) throw new Error('Please sign in to the same account again to sync your saved changes.')
      if (res.status === 429) throw new Error('Sync is busy. Your changes are saved here; please try again shortly.')
      throw new Error('Your changes are saved on this device, but the backup could not finish. Please retry.')
    }
    return res
  } finally { clearTimeout(timeout) }
}

async function wirePayload(db: BitewiseDB, entry: OutboxEntry): Promise<Record<string, unknown> | null> {
  if (!entry.payload) return null
  const payload = { ...entry.payload }
  delete payload.id
  if (entry.table === 'logEntries' && typeof payload.recipeId === 'number') {
    const recipe = await db.recipes.get(payload.recipeId)
    payload.recipeId = recipe?.clientId ?? null
  }
  return payload
}

async function pushOutbox(db: BitewiseDB, userId: string, epoch: number): Promise<string | null> {
  const outbox = await db.syncOutbox.toArray()
  // Recipes need their stable identity on the server before dependent log entries.
  outbox.sort((a, b) => Number(b.table === 'recipes') - Number(a.table === 'recipes'))
  let rejected = false
  const batches: { entries: OutboxEntry[]; mutations: Record<string, unknown>[] }[] = []
  let nextBatch = { entries: [] as OutboxEntry[], mutations: [] as Record<string, unknown>[] }
  let bytes = 32
  for (const entry of outbox) {
    const mutation = {
      table: entry.table, clientId: entry.clientId, operation: entry.operation,
      payload: await wirePayload(db, entry), updatedAt: entry.updatedAt,
    }
    const size = new TextEncoder().encode(JSON.stringify(mutation)).length + 1
    if (size > PUSH_BATCH_BYTES) { rejected = true; continue }
    if (nextBatch.entries.length >= PUSH_BATCH_SIZE || bytes + size > PUSH_BATCH_BYTES) {
      batches.push(nextBatch)
      nextBatch = { entries: [], mutations: [] }
      bytes = 32
    }
    nextBatch.entries.push(entry)
    nextBatch.mutations.push(mutation)
    bytes += size
  }
  if (nextBatch.entries.length) batches.push(nextBatch)
  for (const { entries: batch, mutations } of batches) {
    await assertAccount(db, userId, epoch)
    const res = await fetchSync('/api/sync/push', userId, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mutations }),
    })
    const { flushed } = await res.json() as { flushed?: { table: string; clientId: string; updatedAt: number }[] }
    if (!Array.isArray(flushed)) throw new Error('The backup response was incomplete. Your changes are still saved here.')
    await db.transaction('rw', [db.syncMeta, db.syncOutbox], async () => {
      await assertAccount(db, userId, epoch)
      for (const sent of batch) {
        const acknowledged = flushed.some((ack) => ack.table === sent.table && ack.clientId === sent.clientId && ack.updatedAt === sent.updatedAt)
        if (!acknowledged) { rejected = true; continue }
        const current = sent.id === undefined ? undefined : await db.syncOutbox.get(sent.id)
        // Compare the CURRENT outbox against the EXACT request, never delete by old id alone.
        if (current && current.updatedAt === sent.updatedAt && current.operation === sent.operation && JSON.stringify(current.payload) === JSON.stringify(sent.payload)) {
          await db.syncOutbox.delete(sent.id!)
        }
      }
    })
  }
  return rejected ? 'Some changes could not be backed up. They are still saved on this device. Please retry.' : null
}

type PullResponse = { tables: Record<string, SyncRow[]>; pulledAt?: number; nextCursor?: string | null }
async function fetchPull(userId: string, since: number, cursor?: string): Promise<PullResponse> {
  const query = new URLSearchParams({ since: String(since) })
  if (cursor) query.set('cursor', cursor)
  const res = await fetchSync(`/api/sync/pull?${query}`, userId)
  const data = await res.json() as PullResponse
  if (!data.tables || typeof data.tables !== 'object') throw new Error('Your backup could not be read. Please retry.')
  return data
}

/** Profile detection follows pagination and ignores tombstones. */
export async function serverHasProfile(userId: string): Promise<boolean> {
  let cursor: string | undefined
  const seen = new Set<string>()
  do {
    const data = await fetchPull(userId, 0, cursor)
    if (data.tables.profiles?.some((row) => !row.deletedAt)) return true
    cursor = data.nextCursor ?? undefined
    if (cursor && seen.has(cursor)) throw new Error('The backup response repeated a page. Please retry.')
    if (cursor) seen.add(cursor)
  } while (cursor)
  return false
}

async function pullChanges(db: BitewiseDB, userId: string, since: number, epoch: number): Promise<number | undefined> {
  const rows: Record<string, SyncRow[]> = {}
  let cursor: string | undefined
  let pulledAt: number | undefined
  const seen = new Set<string>()
  do {
    await assertAccount(db, userId, epoch)
    const data = await fetchPull(userId, since, cursor)
    if (pulledAt !== undefined && data.pulledAt !== pulledAt) throw new Error('The backup changed while loading. Please retry.')
    pulledAt = data.pulledAt
    for (const name of SYNCED_TABLES) (rows[name] ??= []).push(...(data.tables[name] ?? []))
    cursor = data.nextCursor ?? undefined
    if (cursor && seen.has(cursor)) throw new Error('The backup response repeated a page. Please retry.')
    if (cursor) seen.add(cursor)
  } while (cursor)

  let writes = 0
  await db.transaction('rw', [...SYNCED_TABLES.map((name) => db.table(name)), db.syncMeta, db.syncOutbox], async () => {
    await assertAccount(db, userId, epoch)
    const pending = new Set((await db.syncOutbox.toArray()).map((row) => `${row.table}:${row.clientId}`))
    const mergeOrder = ['recipes', ...SYNCED_TABLES.filter((name) => name !== 'recipes')] as SyncedTableName[]
    for (const name of mergeOrder) writes += await mergeTable(db, name, rows[name] ?? [], pending, userId)
  })
  if (writes > 0) dataListeners.forEach((fn) => fn())
  return pulledAt
}

async function toLocalRow(db: BitewiseDB, table: SyncedTableName, row: SyncRow): Promise<Record<string, unknown>> {
  const { id: _serverId, userId: _userId, serverChangedAt: _serverChangedAt, ...rest } = row
  if (table === 'logEntries') {
    if (typeof rest.recipeId === 'string') {
      rest.recipeId = (await db.recipes.where('clientId').equals(rest.recipeId).first())?.id
    } else if (rest.recipeId !== undefined) {
      // Device-local numeric keys from old servers must never point at an unrelated recipe.
      rest.recipeId = undefined
    }
    if (rest.loggedAt instanceof Date) rest.loggedAt = rest.loggedAt.toISOString()
  }
  return rest
}

async function mergeTable(db: BitewiseDB, tableName: SyncedTableName, remoteRows: SyncRow[], pending: Set<string>, userId: string): Promise<number> {
  const table = db.table(tableName)
  let writes = 0
  for (const remote of remoteRows) {
    if (remote.userId !== undefined && remote.userId !== userId) throw new Error('The account changed. Sign in again to continue safely.')
    if (pending.has(`${tableName}:${remote.clientId}`)) continue
    const local = await table.where('clientId').equals(remote.clientId).first() as SyncRow | undefined
    if (local && remote.updatedAt < Number(local.updatedAt ?? 0)) continue
    const key = (local?.id ?? local?.barcode) as number | string | undefined
    if (remote.deletedAt) {
      if (key !== undefined) { await table.delete(key); writes++ }
      continue
    }
    const record = await toLocalRow(db, tableName, remote)
    if (local && Object.entries(record).every(([field, value]) => JSON.stringify(local[field]) === JSON.stringify(value))) continue
    if (key !== undefined) await table.update(key, record)
    else await table.put(record)
    writes++
  }
  return writes
}
