import type { BitewiseDB } from '../../data/db'
import { db as defaultDb } from '../../data/db'
import { SYNCED_TABLES } from '../../domain/sync/types'
import { withSyncPaused } from './syncEngine'

export async function hasMadeSignInChoice(db: BitewiseDB = defaultDb): Promise<boolean> {
  return (await db.syncMeta.count()) > 0
}

export async function chooseGuestMode(db: BitewiseDB = defaultDb): Promise<void> {
  await db.transaction('rw', db.syncMeta, async () => {
    if (await db.syncMeta.count()) return
    await db.syncMeta.add({ userId: null, userEmail: null, userName: null, userAvatarUrl: null, lastSyncedAt: null, linkedUserId: null })
  })
}

export async function isGuest(db: BitewiseDB = defaultDb): Promise<boolean> {
  return !(await db.syncMeta.toCollection().first())?.userId
}

/** After server signout, remove backed-up private data from this shared browser. */
export async function signOutLocally(db: BitewiseDB = defaultDb): Promise<void> {
  await withSyncPaused(db, async () => {
    await db.transaction('rw', [...SYNCED_TABLES.map((name) => db.table(name)), db.syncMeta, db.syncOutbox], async () => {
      await clearLocalSyncedData(db)
      await db.syncMeta.clear()
    })
  })
}

/** Never clear pending work: the original account must back it up first. */
export async function clearLocalSyncedData(db: BitewiseDB = defaultDb): Promise<void> {
  await db.transaction('rw', [...SYNCED_TABLES.map((name) => db.table(name)), db.syncOutbox], async () => {
    if (await db.syncOutbox.count() > 0) {
      throw new Error('There are changes waiting to sync for the previous account. Sign in to that account and finish the backup before switching or signing out.')
    }
    for (const name of SYNCED_TABLES) await db.table(name).clear()
  })
}
