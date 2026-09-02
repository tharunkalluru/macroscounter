import type { BitewiseDB } from '../../data/db'
import { db as defaultDb } from '../../data/db'
import { SYNCED_TABLES } from '../../domain/sync/types'

/**
 * True once this device has made its first-launch choice — either "Continue
 * with Google" (a `syncMeta` row with a `userId`) or "Skip for now" (a row
 * with `userId: null`). The presence of any row at all is what gates the
 * `/welcome` screen from showing again, not the value of `userId`.
 */
export async function hasMadeSignInChoice(db: BitewiseDB = defaultDb): Promise<boolean> {
  return (await db.syncMeta.count()) > 0
}

/** "Skip for now" — stay fully local-only. A no-op if a choice already exists. */
export async function chooseGuestMode(db: BitewiseDB = defaultDb): Promise<void> {
  const existing = await db.syncMeta.toCollection().first()
  if (existing) return
  await db.syncMeta.add({
    userId: null,
    userEmail: null,
    userName: null,
    userAvatarUrl: null,
    lastSyncedAt: null,
    linkedUserId: null,
  })
}

export async function isGuest(db: BitewiseDB = defaultDb): Promise<boolean> {
  const meta = await db.syncMeta.toCollection().first()
  return !meta?.userId
}

/**
 * Clears the server session but keeps every local row exactly as it is —
 * signing out only detaches this device from the account going forward.
 * Settings shows "Sign in to back up" again afterward. `linkedUserId` is
 * deliberately left untouched (unlike `userId`): if the *same* account signs
 * back in, `resolveAfterSignIn` re-links this same local data; if a
 * *different* account signs in, it compares against `linkedUserId` to detect
 * that and wipes local data first via `clearLocalSyncedData` instead of
 * merging or migrating one account's data into another's.
 */
export async function signOutLocally(db: BitewiseDB = defaultDb): Promise<void> {
  const meta = await db.syncMeta.toCollection().first()
  const cleared = { userId: null, userEmail: null, userName: null, userAvatarUrl: null }
  if (meta) {
    await db.syncMeta.update(meta.id!, cleared)
  } else {
    await db.syncMeta.add({ ...cleared, lastSyncedAt: null, linkedUserId: null })
  }
}

/**
 * Wipes every synced table (and the pending outbox) on this device — used
 * only when `resolveAfterSignIn` detects that a *different* account is
 * signing in on top of local data linked to someone else. Never touches
 * `foods` (the shared curated database, not user data) or `syncMeta` itself
 * (the caller overwrites that with the new account's identity right after).
 */
export async function clearLocalSyncedData(db: BitewiseDB = defaultDb): Promise<void> {
  for (const tableName of SYNCED_TABLES) {
    await db.table(tableName).clear()
  }
  await db.syncOutbox.clear()
}
