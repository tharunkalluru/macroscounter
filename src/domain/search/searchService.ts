import Fuse, { type IFuseOptions } from 'fuse.js'
import type { Food } from '../fooddb/types'

const FUSE_OPTIONS: IFuseOptions<Food> = {
  keys: [
    { name: 'name', weight: 0.7 },
    { name: 'aliases', weight: 0.3 },
  ],
  threshold: 0.4,
  distance: 100,
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 2,
}

export class FoodSearchService {
  private fuse: Fuse<Food>

  constructor(foods: Food[]) {
    this.fuse = new Fuse(foods, FUSE_OPTIONS)
  }

  search(query: string, limit = 20): Food[] {
    const trimmed = query.trim()
    if (!trimmed) return []
    return this.fuse.search(trimmed, { limit }).map((result) => result.item)
  }
}
