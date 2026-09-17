import { db as defaultDb, type BitewiseDB } from '../../data/db'
import type { Profile, Targets } from '../../data/models'
import { ProfileRepo } from '../../data/repos/ProfileRepo'
import { TargetRepo } from '../../data/repos/TargetRepo'

/** A usable account needs both a profile and its initial targets, or neither. */
export async function saveSetup(profile: Profile, target: Omit<Targets, 'id'>, db: BitewiseDB = defaultDb) {
  return db.transaction('rw', [db.profiles, db.targets, db.syncMeta, db.syncOutbox], async () => {
    await new ProfileRepo(db).save(profile)
    await new TargetRepo(db).add(target)
  })
}
