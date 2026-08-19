import { trackUpsert } from '../../lib/sync/syncTracker'
import type { MacroDesiDB } from '../db'
import { db as defaultDb } from '../db'
import type { Targets } from '../models'

export class TargetRepo {
  constructor(private db: MacroDesiDB = defaultDb) {}

  async add(target: Omit<Targets, 'id'>): Promise<number> {
    const id = await this.db.targets.add(target as Targets)
    await trackUpsert(this.db, 'targets', id, { ...target, id })
    return id
  }

  async getLatest(): Promise<Targets | undefined> {
    return this.db.targets.orderBy('effectiveDate').last()
  }

  async getAll(): Promise<Targets[]> {
    return this.db.targets.orderBy('effectiveDate').toArray()
  }
}
