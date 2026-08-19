import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { MacroDesiDB } from './db'

const DB_NAME = 'macrodesi-migration-test'

afterEach(async () => {
  await Dexie.delete(DB_NAME)
})

describe('Dexie migration: v1 -> current (v3), data intact', () => {
  it('preserves all v1 data and adds the new barcode/clientId indexes and sync tables on upgrade', async () => {
    // Simulate an existing v1 install (pre-Phase-5, before `barcode` had an index).
    const v1db = new Dexie(DB_NAME)
    v1db.version(1).stores({
      profiles: '++id',
      targets: '++id, effectiveDate',
      foods: 'id, category, name',
      recipes: '++id, name',
      logEntries: '++id, date, meal, [date+meal], foodId, recipeId',
      weighIns: '++id, date',
      scannedProducts: 'barcode',
      mealTemplates: '++id, name',
    })
    await v1db.open()

    await v1db.table('profiles').add({
      name: 'Migration Persona',
      sex: 'male',
      age: 28,
      heightCm: 170,
      weightKg: 70,
      activityLevel: 'sedentary',
      goal: 'cut',
    })
    await v1db.table('targets').add({
      effectiveDate: '2026-08-01',
      kcal: 1628,
      proteinG: 126,
      carbsG: 171,
      fatG: 49,
      source: 'computed',
    })
    await v1db.table('foods').add({
      id: 'idli',
      name: 'Idli',
      aliases: ['idly'],
      category: 'south-indian',
      per100g: { kcal: 102.5, p: 4.5, c: 20, f: 0.5, fiber: 0.9 },
      portions: [{ label: '1 idli', grams: 40 }],
      source: 'test',
      verified: true,
    })
    const logEntryId = await v1db.table('logEntries').add({
      date: '2026-08-18',
      meal: 'breakfast',
      foodId: 'idli',
      name: 'Idli',
      portionSummary: '2 x 1 idli',
      qty: 2,
      unit: 'portion',
      grams: 80,
      kcal: 82,
      p: 3.6,
      c: 16,
      f: 0.4,
      barcode: '8901491101615', // present on the row, but unindexed pre-v2
    })
    await v1db.table('weighIns').add({ date: '2026-08-18', weightKg: 79.1 })
    await v1db.table('scannedProducts').add({
      barcode: '8901491101615',
      name: 'Amul Butter',
      per100g: { kcal: 717, p: 0.5, c: 0.1, f: 80 },
      source: 'off',
      firstScanned: '2026-08-10',
    })
    await v1db.table('mealTemplates').add({
      name: 'Usual Breakfast',
      entries: [{ foodId: 'idli', qty: 2, unit: 'portion' }],
    })

    v1db.close()

    // Reopen with the real app class, which declares v1 through v3 -- Dexie
    // upgrades automatically.
    const upgraded = new MacroDesiDB(DB_NAME)
    await upgraded.open()

    expect(upgraded.verno).toBe(3)

    const profiles = await upgraded.profiles.toArray()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].name).toBe('Migration Persona')

    const targets = await upgraded.targets.toArray()
    expect(targets[0].kcal).toBe(1628)

    const food = await upgraded.foods.get('idli')
    expect(food?.name).toBe('Idli')

    const logEntry = await upgraded.logEntries.get(logEntryId as number)
    expect(logEntry).toMatchObject({ name: 'Idli', kcal: 82, barcode: '8901491101615' })

    const weighIns = await upgraded.weighIns.toArray()
    expect(weighIns[0].weightKg).toBe(79.1)

    const scannedProduct = await upgraded.scannedProducts.get('8901491101615')
    expect(scannedProduct?.name).toBe('Amul Butter')

    const templates = await upgraded.mealTemplates.toArray()
    expect(templates[0].name).toBe('Usual Breakfast')

    // The v2 index actually works, not just "doesn't crash".
    const byBarcode = await upgraded.logEntries.where('barcode').equals('8901491101615').toArray()
    expect(byBarcode).toHaveLength(1)
    expect(byBarcode[0].id).toBe(logEntryId)

    // v3: pre-existing rows have no clientId yet (backfilled lazily by the
    // sync engine, not by this migration) — the new index still works, it's
    // just empty for now. The new sync tables exist and are usable.
    const byClientId = await upgraded.logEntries.where('clientId').equals('anything').toArray()
    expect(byClientId).toHaveLength(0)
    expect(await upgraded.syncOutbox.count()).toBe(0)
    expect(await upgraded.syncMeta.count()).toBe(0)

    upgraded.close()
  })
})
