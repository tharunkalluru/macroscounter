import type { MacroDesiDB } from '../../data/db'
import { db as defaultDb } from '../../data/db'

/**
 * True once this device has made its first-launch choice — either "Continue
 * with Google" (a `syncMeta` row with a `userId`) or "Skip for now" (a row
 * with `userId: null`). The presence of any row at all is what gates the
 * `/welcome` screen from showing again, not the value of `userId`.
 */
export async function hasMadeSignInChoice(db: MacroDesiDB = defaultDb): Promise<boolean> {
  return (await db.syncMeta.count()) > 0
}

/** "Skip for now" — stay fully local-only. A no-op if a choice already exists. */
export async function chooseGuestMode(db: MacroDesiDB = defaultDb): Promise<void> {
  const existing = await db.syncMeta.toCollection().first()
  if (existing) return
  await db.syncMeta.add({
    userId: null,
    userEmail: null,
    userName: null,
    userAvatarUrl: null,
    lastSyncedAt: null,
  })
}

export async function isGuest(db: MacroDesiDB = defaultDb): Promise<boolean> {
  const meta = await db.syncMeta.toCollection().first()
  return !meta?.userId
}

/**
 * Clears the server session but keeps every local row exactly as it is —
 * signing out only detaches this device from the account going forward.
 * Settings shows "Sign in to back up" again afterward, which re-links the
 * same local data the next time they sign in (same migrate-if-server-empty
 * path `resolveAfterSignIn` already runs for a guest's first sign-in).
 */
export async function signOutLocally(db: MacroDesiDB = defaultDb): Promise<void> {
  const meta = await db.syncMeta.toCollection().first()
  const cleared = { userId: null, userEmail: null, userName: null, userAvatarUrl: null }
  if (meta) {
    await db.syncMeta.update(meta.id!, cleared)
  } else {
    await db.syncMeta.add({ ...cleared, lastSyncedAt: null })
  }
}
