import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MacroDesiDB } from '../db'
import type { MealTemplate } from '../models'
import { MealTemplateRepo } from './MealTemplateRepo'

const sample = (overrides: Partial<MealTemplate> = {}): Omit<MealTemplate, 'id'> => ({
  name: 'Usual Breakfast',
  entries: [
    { foodId: 'idli', qty: 3, unit: 'portion' },
    { foodId: 'sambar', qty: 1, unit: 'portion' },
  ],
  ...overrides,
})

let db: MacroDesiDB
let repo: MealTemplateRepo

beforeEach(() => {
  db = new MacroDesiDB(`test-mealtemplate-${Math.random()}`)
  repo = new MealTemplateRepo(db)
})

afterEach(async () => {
  await db.delete()
})

describe('MealTemplateRepo', () => {
  it('adds a template and lists it back', async () => {
    await repo.add(sample())
    const all = await repo.listAll()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('Usual Breakfast')
    expect(all[0].entries).toHaveLength(2)
  })

  it('round-trips: add -> update -> delete', async () => {
    const id = await repo.add(sample())
    await repo.update(id, { name: 'Renamed' })
    expect((await repo.getById(id))?.name).toBe('Renamed')

    await repo.delete(id)
    expect(await repo.getById(id)).toBeUndefined()
  })
})
