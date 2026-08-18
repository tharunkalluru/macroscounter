import type { MacroDesiDB } from '../db'
import { db as defaultDb } from '../db'
import type { MealTemplate } from '../models'

export class MealTemplateRepo {
  constructor(private db: MacroDesiDB = defaultDb) {}

  async add(template: Omit<MealTemplate, 'id'>): Promise<number> {
    return this.db.mealTemplates.add(template as MealTemplate)
  }

  async update(id: number, changes: Partial<Omit<MealTemplate, 'id'>>): Promise<void> {
    await this.db.mealTemplates.update(id, changes)
  }

  async delete(id: number): Promise<void> {
    await this.db.mealTemplates.delete(id)
  }

  async getById(id: number): Promise<MealTemplate | undefined> {
    return this.db.mealTemplates.get(id)
  }

  async listAll(): Promise<MealTemplate[]> {
    return this.db.mealTemplates.toArray()
  }
}
