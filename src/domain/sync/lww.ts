import type { SyncRow } from './types'

/**
 * Last-write-wins: given the local and remote copies of the same row,
 * returns whichever has the newer `updatedAt`. Ties go to remote (the
 * server is the tie-break authority, since two devices producing the exact
 * same millisecond is the only case where "who wins" is genuinely
 * arbitrary). A remote row missing entirely (`undefined` local) always wins
 * since there's nothing to compare against.
 */
export function resolveLWW<T extends SyncRow>(local: T | undefined, remote: T): T {
  if (!local) return remote
  return remote.updatedAt >= local.updatedAt ? remote : local
}

/**
 * Merges a batch of remote rows (a sync pull) into the local table's rows,
 * applying LWW per row. Local rows with no remote counterpart in this batch
 * are left untouched (a partial/incremental pull, not a full replace).
 */
export function mergeRemoteRows<T extends SyncRow>(localRows: T[], remoteRows: T[]): T[] {
  const localByClientId = new Map(localRows.map((row) => [row.clientId, row]))
  for (const remote of remoteRows) {
    const winner = resolveLWW(localByClientId.get(remote.clientId), remote)
    localByClientId.set(remote.clientId, winner)
  }
  return Array.from(localByClientId.values())
}
