import type { BitewiseDB } from '../db'
import { db as defaultDb } from '../db'
import type { FoodRecord } from '../models'

export class FoodRepo {
  constructor(private db: BitewiseDB = defaultDb) {}

  async seedIfEmpty(foods: FoodRecord[]): Promise<number> {
    const count = await this.db.foods.count()
    if (count > 0) return count
    await this.db.foods.bulkPut(foods)
    return this.db.foods.count()
  }

  async getById(id: string): Promise<FoodRecord | undefined> {
    return this.db.foods.get(id)
  }

  async getByIds(ids: string[]): Promise<FoodRecord[]> {
    const results = await this.db.foods.bulkGet(ids)
    return results.filter((f): f is FoodRecord => f !== undefined)
  }

  async listAll(): Promise<FoodRecord[]> {
    return this.db.foods.toArray()
  }

  async listByCategory(category: FoodRecord['category']): Promise<FoodRecord[]> {
    return this.db.foods.where('category').equals(category).toArray()
  }

  async put(food: FoodRecord): Promise<string> {
    return this.db.foods.put(food)
  }

  async delete(id: string): Promise<void> {
    await this.db.foods.delete(id)
  }

  async count(): Promise<number> {
    return this.db.foods.count()
  }

  async listFavorites(): Promise<FoodRecord[]> {
    return this.db.foods.filter((f) => f.favorite === true).toArray()
  }

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    await this.db.foods.update(id, { favorite })
  }
}
