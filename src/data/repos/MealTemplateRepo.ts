import { trackDelete, trackUpsert } from '../../lib/sync/syncTracker'
import type { BitewiseDB } from '../db'
import { db as defaultDb } from '../db'
import type { MealTemplate } from '../models'

export class MealTemplateRepo {
  constructor(private db: BitewiseDB = defaultDb) {}

  async add(template: Omit<MealTemplate, 'id'>): Promise<number> {
    return this.db.transaction('rw', [this.db.mealTemplates, this.db.syncMeta, this.db.syncOutbox], async () => {
      const id = await this.db.mealTemplates.add(template as MealTemplate)
      await trackUpsert(this.db, 'mealTemplates', id, { ...template, id })
      return id
    })
  }

  async update(id: number, changes: Partial<Omit<MealTemplate, 'id'>>): Promise<void> {
    return this.db.transaction('rw', [this.db.mealTemplates, this.db.syncMeta, this.db.syncOutbox], async () => {
      await this.db.mealTemplates.update(id, changes)
      const updated = await this.db.mealTemplates.get(id)
      if (updated) await trackUpsert(this.db, 'mealTemplates', id, updated)
    })
  }

  async delete(id: number): Promise<void> {
    return this.db.transaction('rw', [this.db.mealTemplates, this.db.syncMeta, this.db.syncOutbox], async () => {
      const existing = await this.db.mealTemplates.get(id)
      await this.db.mealTemplates.delete(id)
      if (existing) await trackDelete(this.db, 'mealTemplates', existing.clientId)
    })
  }

  async getById(id: number): Promise<MealTemplate | undefined> {
    return this.db.mealTemplates.get(id)
  }

  async listAll(): Promise<MealTemplate[]> {
    return this.db.mealTemplates.toArray()
  }
}
