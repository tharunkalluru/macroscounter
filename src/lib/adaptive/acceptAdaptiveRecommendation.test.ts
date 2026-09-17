import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BitewiseDB } from '../../data/db'
import { fetchAdaptiveRecommendation } from './fetchAdaptiveRecommendation'
import { acceptAdaptiveRecommendation } from './acceptAdaptiveRecommendation'
import { addDaysISO, todayISO } from '../date'

let db: BitewiseDB
beforeEach(async () => {
  db = new BitewiseDB(`adaptive-basis-${Math.random()}`)
  const date = todayISO()
  await db.profiles.add({ name: 'Test', age: 30, sex: 'male', heightCm: 180, weightKg: 80, activityLevel: 'moderate', goal: 'cut' })
  await db.targets.add({ effectiveDate: addDaysISO(date, -7), kcal: 2200, proteinG: 150, fatG: 70, carbsG: 243, source: 'computed' })
  await db.logEntries.bulkAdd(Array.from({ length: 7 }, (_, index) => ({ date: addDaysISO(date, -6 + index), meal: 'lunch', name: 'Test meal', portionSummary: '1 portion', qty: 1, unit: 'portion', grams: 400, kcal: 2200, p: 150, c: 240, f: 70 })))
  await db.weighIns.bulkAdd([{ date: addDaysISO(date, -6), weightKg: 80 }, { date, weightKg: 80 }])
})
afterEach(async () => { await db.delete() })

async function proposal() {
  const { recommendation } = await fetchAdaptiveRecommendation(todayISO(), db)
  expect(recommendation).not.toBeNull()
  return recommendation!
}

describe('atomic adaptive review identity', () => {
  it('rejects a same-calorie macro edit after the plan was previewed', async () => {
    const recommendation = await proposal()
    await db.targets.update(1, { proteinG: 170, fatG: 60, carbsG: 245 })
    await expect(acceptAdaptiveRecommendation(recommendation, db)).rejects.toThrow('plan changed')
    expect(await db.targets.count()).toBe(1)
  })
  it('rejects a changed goal or rate even when the current calorie target is unchanged', async () => {
    const recommendation = await proposal()
    await db.profiles.update(1, { goal: 'maintain' })
    await expect(acceptAdaptiveRecommendation(recommendation, db)).rejects.toThrow('plan changed')
    await db.profiles.update(1, { goal: 'cut', goalRateLbPerWeek: 0.5 })
    await expect(acceptAdaptiveRecommendation(recommendation, db)).rejects.toThrow('plan changed')
    expect(await db.targets.count()).toBe(1)
  })
  it('rejects an identical replacement target with a different identity', async () => {
    const recommendation = await proposal()
    const previous = (await db.targets.get(1))!
    const { id: _id, ...replacement } = previous
    await db.targets.add(replacement)
    await expect(acceptAdaptiveRecommendation(recommendation, db)).rejects.toThrow('plan changed')
    expect(await db.targets.count()).toBe(2)
  })
  it('serializes concurrent acceptance so the same preview cannot apply twice', async () => {
    const recommendation = await proposal()
    const outcomes = await Promise.allSettled([acceptAdaptiveRecommendation(recommendation, db), acceptAdaptiveRecommendation(recommendation, db)])
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(await db.targets.count()).toBe(2)
  })
  it('requires a reviewed basis rather than accepting a bare pure calculation', async () => {
    const { basis: _basis, ...withoutBasis } = await proposal()
    await expect(acceptAdaptiveRecommendation(withoutBasis, db)).rejects.toThrow('plan changed')
  })
})
