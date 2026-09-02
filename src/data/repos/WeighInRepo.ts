import { trackDelete, trackUpsert } from '../../lib/sync/syncTracker'
import type { BitewiseDB } from '../db'
import { db as defaultDb } from '../db'
import type { WeighIn } from '../models'

export class WeighInRepo {
  constructor(private db: BitewiseDB = defaultDb) {}

  async add(weighIn: Omit<WeighIn, 'id'>): Promise<number> {
    const id = await this.db.weighIns.add(weighIn as WeighIn)
    await trackUpsert(this.db, 'weighIns', id, { ...weighIn, id })
    return id
  }

  async update(id: number, changes: Partial<Omit<WeighIn, 'id'>>): Promise<void> {
    await this.db.weighIns.update(id, changes)
    const updated = await this.db.weighIns.get(id)
    if (updated) await trackUpsert(this.db, 'weighIns', id, updated)
  }

  async delete(id: number): Promise<void> {
    const existing = await this.db.weighIns.get(id)
    await this.db.weighIns.delete(id)
    if (existing) await trackDelete(this.db, 'weighIns', existing.clientId)
  }

  async getAll(): Promise<WeighIn[]> {
    return this.db.weighIns.orderBy('date').toArray()
  }

  async getInRange(startDate: string, endDate: string): Promise<WeighIn[]> {
    return this.db.weighIns.where('date').between(startDate, endDate, true, true).toArray()
  }

  async getLatest(): Promise<WeighIn | undefined> {
    return this.db.weighIns.orderBy('date').last()
  }
}
