import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BitewiseDB } from '../db'
import type { Recipe } from '../models'
import { RecipeRepo } from './RecipeRepo'

const sampleRecipe = (overrides: Partial<Recipe> = {}): Omit<Recipe, 'id'> => ({
  name: 'Idli Sambar Combo',
  ingredients: [
    { foodId: 'idli', grams: 80 },
    { foodId: 'sambar', grams: 150 },
  ],
  servings: 1,
  computedPer100g: { kcal: 76.1, p: 3.5, c: 12.2, f: 1.5 },
  ...overrides,
})

let db: BitewiseDB
let repo: RecipeRepo

beforeEach(() => {
  db = new BitewiseDB(`test-recipe-${Math.random()}`)
  repo = new RecipeRepo(db)
})

afterEach(async () => {
  await db.delete()
})

describe('RecipeRepo', () => {
  it('adds a recipe and lists it back', async () => {
    await repo.add(sampleRecipe())
    const all = await repo.listAll()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Idli Sambar Combo')
  })

  it('round-trips: add -> update -> delete', async () => {
    const id = await repo.add(sampleRecipe())
    await repo.update(id, { servings: 2 })
    expect((await repo.getById(id))?.servings).toBe(2)

    await repo.delete(id)
    expect(await repo.getById(id)).toBeUndefined()
  })
})
