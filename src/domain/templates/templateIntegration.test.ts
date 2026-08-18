import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MacroDesiDB } from '../../data/db'
import { FoodRepo } from '../../data/repos/FoodRepo'
import { LogRepo } from '../../data/repos/LogRepo'
import { MealTemplateRepo } from '../../data/repos/MealTemplateRepo'
import { applyTemplate } from './applyTemplate'

let db: MacroDesiDB
let foodRepo: FoodRepo
let templateRepo: MealTemplateRepo
let logRepo: LogRepo

beforeEach(() => {
  db = new MacroDesiDB(`test-template-integration-${Math.random()}`)
  foodRepo = new FoodRepo(db)
  templateRepo = new MealTemplateRepo(db)
  logRepo = new LogRepo(db)
})

afterEach(async () => {
  await db.delete()
})

describe('template integration: save template -> one-tap apply -> correct log entries', () => {
  it('logs exactly the entries the template describes, with correctly computed macros', async () => {
    await foodRepo.put({
      id: 'idli',
      name: 'Idli',
      aliases: [],
      category: 'south-indian',
      per100g: { kcal: 102.5, p: 4.5, c: 20, f: 0.5, fiber: 0.9 },
      portions: [{ label: '1 idli', grams: 40 }],
      source: 'test',
      verified: true,
    })
    await foodRepo.put({
      id: 'sambar',
      name: 'Sambar',
      aliases: [],
      category: 'south-indian',
      per100g: { kcal: 62, p: 3, c: 8, f: 2, fiber: 2.2 },
      portions: [{ label: '1 katori', grams: 150 }],
      source: 'test',
      verified: true,
    })

    const templateId = await templateRepo.add({
      name: 'Usual Breakfast',
      entries: [
        { foodId: 'idli', qty: 3, unit: 'portion' },
        { foodId: 'sambar', qty: 1, unit: 'portion' },
      ],
    })

    // One-tap log: load the template, resolve against current food data, write log entries.
    const template = await templateRepo.getById(templateId)
    const foods = await foodRepo.getByIds(template!.entries.map((e) => e.foodId))
    const foodsById = new Map(foods.map((f) => [f.id, f]))
    const resolved = applyTemplate(template!.entries, foodsById)

    const date = '2026-08-19'
    for (const entry of resolved) {
      await logRepo.addEntry({ date, meal: 'breakfast', ...entry })
    }

    const loggedEntries = await logRepo.getEntriesForDate(date)
    expect(loggedEntries).toHaveLength(2)

    const idliEntry = loggedEntries.find((e) => e.foodId === 'idli')
    expect(idliEntry).toMatchObject({ name: 'Idli', qty: 3, grams: 120, kcal: 123, p: 5.4, c: 24, f: 0.6 })

    const sambarEntry = loggedEntries.find((e) => e.foodId === 'sambar')
    expect(sambarEntry).toMatchObject({ name: 'Sambar', qty: 1, grams: 150, kcal: 93, p: 4.5, c: 12, f: 3 })
  })
})
