import type { OutboxEntry } from './types'

/**
 * Adds a mutation to the outbox, collapsing it with any existing queued
 * mutation for the same (table, clientId) — only the latest state of a row
 * needs to be pushed, not every intermediate edit. The collapsed entry keeps
 * the EARLIEST queued entry's `id` (so an already-persisted Dexie row is
 * updated in place rather than duplicated) but the LATEST payload/timestamp.
 */
export function enqueueMutation(outbox: OutboxEntry[], entry: OutboxEntry): OutboxEntry[] {
  const existingIndex = outbox.findIndex((e) => e.table === entry.table && e.clientId === entry.clientId)
  if (existingIndex === -1) {
    return [...outbox, entry]
  }
  const existing = outbox[existingIndex]
  const merged: OutboxEntry = { ...entry, id: existing.id }
  const next = [...outbox]
  next[existingIndex] = merged
  return next
}

/**
 * Removes outbox entries that were successfully flushed to the server —
 * but only if nothing newer queued up for that row while the push was in
 * flight (compared by `updatedAt`), so a mutation made during an in-flight
 * push is never silently dropped.
 */
export function reconcileAfterPush(
  outbox: OutboxEntry[],
  flushed: { table: string; clientId: string; updatedAt: number }[]
): OutboxEntry[] {
  return outbox.filter((entry) => {
    const match = flushed.find((f) => f.table === entry.table && f.clientId === entry.clientId)
    if (!match) return true
    return entry.updatedAt > match.updatedAt
  })
}
