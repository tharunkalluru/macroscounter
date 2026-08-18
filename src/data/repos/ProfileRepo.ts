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
    if (existing?.id !== undefined) {
      await this.db.profiles.update(existing.id, profile)
      return existing.id
    }
    return this.db.profiles.add(profile)
  }
}
