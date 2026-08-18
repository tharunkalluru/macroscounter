import type { MacroDesiDB } from '../db'
import { db as defaultDb } from '../db'
import type { WeighIn } from '../models'

export class WeighInRepo {
  constructor(private db: MacroDesiDB = defaultDb) {}

  async add(weighIn: Omit<WeighIn, 'id'>): Promise<number> {
    return this.db.weighIns.add(weighIn as WeighIn)
  }

  async update(id: number, changes: Partial<Omit<WeighIn, 'id'>>): Promise<void> {
    await this.db.weighIns.update(id, changes)
  }

  async delete(id: number): Promise<void> {
    await this.db.weighIns.delete(id)
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
