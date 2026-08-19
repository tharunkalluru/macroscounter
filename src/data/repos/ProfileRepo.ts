import { trackUpsert } from '../../lib/sync/syncTracker'
import type { MacroDesiDB } from '../db'
import { db as defaultDb } from '../db'
import type { Profile } from '../models'

export class ProfileRepo {
  constructor(private db: MacroDesiDB = defaultDb) {}

  /** Single-user app: at most one profile row ever exists. */
  async get(): Promise<Profile | undefined> {
    return this.db.profiles.toCollection().first()
  }

  async save(profile: Profile): Promise<number> {
    const existing = await this.get()
    let id: number
    if (existing?.id !== undefined) {
      await this.db.profiles.update(existing.id, profile)
      id = existing.id
    } else {
      id = await this.db.profiles.add(profile)
    }
    const saved = await this.db.profiles.get(id)
    if (saved) await trackUpsert(this.db, 'profiles', id, saved)
    return id
  }
}
