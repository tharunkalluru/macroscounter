import type { MacroDesiDB } from '../db'
import { db as defaultDb } from '../db'
import type { Recipe } from '../models'

export class RecipeRepo {
  constructor(private db: MacroDesiDB = defaultDb) {}

  async add(recipe: Omit<Recipe, 'id'>): Promise<number> {
    return this.db.recipes.add(recipe as Recipe)
  }

  async update(id: number, changes: Partial<Omit<Recipe, 'id'>>): Promise<void> {
    await this.db.recipes.update(id, changes)
  }

  async getById(id: number): Promise<Recipe | undefined> {
    return this.db.recipes.get(id)
  }

  async listAll(): Promise<Recipe[]> {
    return this.db.recipes.toArray()
  }

  async delete(id: number): Promise<void> {
    await this.db.recipes.delete(id)
  }
}
