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

export type SyncOperation = 'upsert' | 'delete'

/** A queued local mutation, waiting to be pushed to the server. */
export interface OutboxEntry {
  id?: number
  table: SyncedTableName
  clientId: string
  operation: SyncOperation
  /** The full row at the time of mutation; absent for deletes (the clientId is enough). */
  payload: Record<string, unknown> | null
  updatedAt: number
}

/** Any row that participates in sync must carry these three fields. */
export interface SyncRow {
  clientId: string
  updatedAt: number
  deletedAt: number | null
  [key: string]: unknown
}
