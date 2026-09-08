import { authClient } from '../auth/authClient'
import type { BitewiseDB } from '../../data/db'
import { db as defaultDb } from '../../data/db'
import { SYNCED_TABLES } from '../../domain/sync/types'
import { clearLocalSyncedData } from './guestMode'
import { migrateLocalToCloud } from './migrateLocalToCloud'
import { getSyncError, runSync, serverHasProfile, withSyncPaused } from './syncEngine'
import { trackUpsert } from './syncTracker'

export type PostSignInOutcome = 'onboarding' | 'ready'
const resolutions = new WeakMap<BitewiseDB, Promise<PostSignInOutcome>>()

/** Deduplicate auth effects; account identity is established before any local work is pushed. */
export function resolveAfterSignIn(db: BitewiseDB = defaultDb): Promise<PostSignInOutcome> {
  const active = resolutions.get(db)
  if (active) return active
  const promise = resolve(db).finally(() => resolutions.delete(db))
  resolutions.set(db, promise)
  return promise
}

async function resolve(db: BitewiseDB): Promise<PostSignInOutcome> {
  const { data: session, error } = await authClient.getSession()
  if (error) throw new Error('We could not check your account. Please try again.')
  if (!session) return 'onboarding'
  const userId = session.user.id

  // Read the server before changing ownership or removing anything locally.
  const hasServerProfile = await serverHasProfile(userId)
  let migrateAll = false
  await withSyncPaused(db, async () => {
    await db.transaction('rw', [...SYNCED_TABLES.map((name) => db.table(name)), db.syncMeta, db.syncOutbox], async () => {
      const existingMeta = await db.syncMeta.toCollection().first()
      const linkedId = existingMeta?.linkedUserId ?? existingMeta?.userId
      const differentAccount = !!linkedId && linkedId !== userId
      if (differentAccount) await clearLocalSyncedData(db)
      const guestData = !linkedId && !!(await db.profiles.count())
      const hadLocalProfile = !!(await db.profiles.count())
      const fields = {
        userId, userEmail: session.user.email, userName: session.user.name,
        userAvatarUrl: session.user.image ?? null, linkedUserId: userId,
        // The first pull after sign-in is complete, including returning-account recovery.
        lastSyncedAt: null,
      }
      if (existingMeta) await db.syncMeta.update(existingMeta.id!, fields)
      else await db.syncMeta.add(fields)

      if (guestData && hasServerProfile) {
        // Keep the guest's actual diary and reusable meals. Their cloud profile/goals
        // take precedence, preventing duplicate profile rows on a returning account.
        for (const name of SYNCED_TABLES.filter((name) => name !== 'profiles' && name !== 'targets')) {
          const rows = await db.table(name).toArray() as Record<string, unknown>[]
          for (const row of rows) await trackUpsert(db, name, (row.id ?? row.barcode) as number | string, row)
        }
        await db.profiles.clear()
        await db.targets.clear()
      }
      migrateAll = !hasServerProfile && hadLocalProfile
    })
  })
  if (migrateAll) await migrateLocalToCloud(db)
  const status = await runSync(db)
  if (status !== 'synced') throw new Error(getSyncError() ?? 'Connect to the internet to finish setting up your backup, then try again.')
  return (await db.profiles.count()) > 0 ? 'ready' : 'onboarding'
}
