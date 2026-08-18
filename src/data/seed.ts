import { FoodRepo } from './repos/FoodRepo'
import type { FoodRecord } from './models'

/**
 * One-time seed of the bundled food DB into IndexedDB. After this succeeds
 * once, every other read goes through IndexedDB (FoodRepo), never a network
 * fetch — that's what makes search/logging work fully offline.
 */
export async function ensureFoodDbSeeded(repo: FoodRepo = new FoodRepo()): Promise<void> {
  const count = await repo.count()
  if (count > 0) return

  const res = await fetch('/fooddb.json')
  if (!res.ok) throw new Error(`Failed to load food database: ${res.status}`)
  const foods: FoodRecord[] = await res.json()
  await repo.seedIfEmpty(foods)
}
