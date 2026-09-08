import { trackDelete, trackUpsert } from '../../lib/sync/syncTracker'
import type { BitewiseDB } from '../db'
import { db as defaultDb } from '../db'
import type { Recipe } from '../models'

export class RecipeRepo {
  constructor(private db: BitewiseDB = defaultDb) {}

  async add(recipe: Omit<Recipe, 'id'>): Promise<number> {
    return this.db.transaction('rw', [this.db.recipes, this.db.syncMeta, this.db.syncOutbox], async () => {
      const id = await this.db.recipes.add(recipe as Recipe)
      await trackUpsert(this.db, 'recipes', id, { ...recipe, id })
      return id
    })
  }

  async update(id: number, changes: Partial<Omit<Recipe, 'id'>>): Promise<void> {
    return this.db.transaction('rw', [this.db.recipes, this.db.syncMeta, this.db.syncOutbox], async () => {
      await this.db.recipes.update(id, changes)
      const updated = await this.db.recipes.get(id)
      if (updated) await trackUpsert(this.db, 'recipes', id, updated)
    })
  }

  async getById(id: number): Promise<Recipe | undefined> {
    return this.db.recipes.get(id)
  }

  async listAll(): Promise<Recipe[]> {
    return this.db.recipes.toArray()
  }

  async delete(id: number): Promise<void> {
    return this.db.transaction('rw', [this.db.recipes, this.db.syncMeta, this.db.syncOutbox], async () => {
      const existing = await this.db.recipes.get(id)
      await this.db.recipes.delete(id)
      if (existing) await trackDelete(this.db, 'recipes', existing.clientId)
    })
  }
}
