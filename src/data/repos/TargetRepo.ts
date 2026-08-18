import type { MacroDesiDB } from '../db'
import { db as defaultDb } from '../db'
import type { Targets } from '../models'

export class TargetRepo {
  constructor(private db: MacroDesiDB = defaultDb) {}

  async add(target: Omit<Targets, 'id'>): Promise<number> {
    return this.db.targets.add(target as Targets)
  }

  async getLatest(): Promise<Targets | undefined> {
    return this.db.targets.orderBy('effectiveDate').last()
  }

  async getAll(): Promise<Targets[]> {
    return this.db.targets.orderBy('effectiveDate').toArray()
  }
}
