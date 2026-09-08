import { trackUpsert } from '../../lib/sync/syncTracker'
import type { BitewiseDB } from '../db'
import { db as defaultDb } from '../db'
import type { Profile } from '../models'

export class ProfileRepo {
  constructor(private db: BitewiseDB = defaultDb) {}

  /** Resolve concurrent first-device setup deterministically on every device. */
  async get(): Promise<Profile | undefined> {
    const rows = await this.db.profiles.toArray()
    return rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0) || (b.clientId ?? '').localeCompare(a.clientId ?? '') || (b.id ?? 0) - (a.id ?? 0))[0]
  }

  async save(profile: Profile): Promise<number> {
    return this.db.transaction('rw', [this.db.profiles, this.db.syncMeta, this.db.syncOutbox], async () => {
      const existing = await this.get()
      let id: number
      if (existing?.id !== undefined) {
        await this.db.profiles.update(existing.id, profile)
        id = existing.id
      } else {
        id = await this.db.profiles.add({ ...profile })
      }
      const saved = await this.db.profiles.get(id)
      if (saved) await trackUpsert(this.db, 'profiles', id, saved)
      return id
    })
  }
}
