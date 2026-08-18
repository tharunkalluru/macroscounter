import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MacroDesiDB } from '../db'
import type { FoodRecord } from '../models'
import { FoodRepo } from './FoodRepo'

const sampleFood = (overrides: Partial<FoodRecord> = {}): FoodRecord => ({
  id: 'idli',
  name: 'Idli',
  aliases: ['idly'],
  category: 'south-indian',
  per100g: { kcal: 103, p: 4.5, c: 20, f: 0.5, fiber: 0.9 },
  portions: [{ label: '1 idli', grams: 40 }],
  source: 'IFCT-2017-derived',
  verified: true,
  ...overrides,
})

let db: MacroDesiDB
let repo: FoodRepo

beforeEach(() => {
  db = new MacroDesiDB(`test-food-${Math.random()}`)
  repo = new FoodRepo(db)
})

afterEach(async () => {
  await db.delete()
})

describe('FoodRepo', () => {
  it('round-trips a food through put and getById', async () => {
    await repo.put(sampleFood())
    const found = await repo.getById('idli')
    expect(found?.name).toBe('Idli')
  })

  it('seedIfEmpty populates an empty table and is a no-op when already seeded', async () => {
    const foods = [sampleFood(), sampleFood({ id: 'dosa', name: 'Plain Dosa' })]
    const countAfterFirstSeed = await repo.seedIfEmpty(foods)
    expect(countAfterFirstSeed).toBe(2)

    const countAfterSecondSeed = await repo.seedIfEmpty([sampleFood({ id: 'extra' })])
    expect(countAfterSecondSeed).toBe(2)
  })

  it('lists all foods and filters by category', async () => {
    await repo.put(sampleFood())
    await repo.put(sampleFood({ id: 'chicken-curry', name: 'Chicken Curry', category: 'chicken' }))

    expect(await repo.listAll()).toHaveLength(2)
    expect(await repo.listByCategory('chicken')).toHaveLength(1)
  })

  it('gets multiple foods by id, skipping missing ones', async () => {
    await repo.put(sampleFood())
    const results = await repo.getByIds(['idli', 'does-not-exist'])
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('idli')
  })

  it('deletes a food', async () => {
    await repo.put(sampleFood())
    await repo.delete('idli')
    expect(await repo.getById('idli')).toBeUndefined()
  })
})
