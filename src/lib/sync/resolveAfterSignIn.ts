import { authClient } from '../auth/authClient'
import type { MacroDesiDB } from '../../data/db'
import { db as defaultDb } from '../../data/db'
import { migrateLocalToCloud } from './migrateLocalToCloud'
import { runSync, serverHasProfile } from './syncEngine'

export type PostSignInOutcome = 'onboarding' | 'ready'

/**
 * Runs once we know a Better Auth session exists (cookie set, either from
 * just completing the Google redirect or already present from an earlier
 * visit on this browser). Decides, per 10B of the phase-10 spec:
 *
 * 1. If the server already has data for this account (a returning user, or
 *    the same account on another device) — pull it. That always wins; local
 *    data is never pushed on top of it.
 * 2. Else, if this device has pre-existing local (guest) usage — migrate it
 *    up to the account automatically.
 * 3. Else — brand-new account with nothing anywhere — the caller sends the
 *    user to onboarding.
 */
export async function resolveAfterSignIn(db: MacroDesiDB = defaultDb): Promise<PostSignInOutcome> {
  const { data: session } = await authClient.getSession()
  if (!session) return 'onboarding'

  const hadLocalProfile = !!(await db.profiles.toCollection().first())

  const existingMeta = await db.syncMeta.toCollection().first()
  const metaFields = {
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    userAvatarUrl: session.user.image ?? null,
  }
  if (existingMeta) {
    await db.syncMeta.update(existingMeta.id!, metaFields)
  } else {
    await db.syncMeta.add({ ...metaFields, lastSyncedAt: null })
  }

  const hasServerProfile = await serverHasProfile()
  if (!hasServerProfile && hadLocalProfile) {
    await migrateLocalToCloud(db)
  } else {
    await runSync(db)
  }

  const hasProfileNow = !!(await db.profiles.toCollection().first())
  return hasProfileNow ? 'ready' : 'onboarding'
}
