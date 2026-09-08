import { trackUpsert } from '../../lib/sync/syncTracker'
import type { BitewiseDB } from '../db'
import { db as defaultDb } from '../db'
import type { Targets } from '../models'

export class TargetRepo {
  constructor(private db: BitewiseDB = defaultDb) {}

  async add(target: Omit<Targets, 'id'>): Promise<number> {
    return this.db.transaction('rw', [this.db.targets, this.db.syncMeta, this.db.syncOutbox], async () => {
      const id = await this.db.targets.add(target as Targets)
      await trackUpsert(this.db, 'targets', id, { ...target, id })
      return id
    })
  }

  async getLatest(): Promise<Targets | undefined> {
    return (await this.getAll()).at(-1)
  }

  async getAll(): Promise<Targets[]> {
    const rows = await this.db.targets.toArray()
    return rows.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || (a.updatedAt ?? 0) - (b.updatedAt ?? 0) || (a.clientId ?? '').localeCompare(b.clientId ?? '') || (a.id ?? 0) - (b.id ?? 0))
  }
}
