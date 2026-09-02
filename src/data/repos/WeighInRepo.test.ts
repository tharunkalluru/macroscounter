import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BitewiseDB } from '../db'
import { WeighInRepo } from './WeighInRepo'

let db: BitewiseDB
let repo: WeighInRepo

beforeEach(() => {
  db = new BitewiseDB(`test-weighin-${Math.random()}`)
  repo = new WeighInRepo(db)
})

afterEach(async () => {
  await db.delete()
})

describe('WeighInRepo', () => {
  it('adds and lists weigh-ins ordered by date', async () => {
    await repo.add({ date: '2026-08-18', weightKg: 79.1 })
    await repo.add({ date: '2026-08-10', weightKg: 80 })
    const all = await repo.getAll()
    expect(all.map((w) => w.date)).toEqual(['2026-08-10', '2026-08-18'])
  })

  it('round-trips: add -> update -> delete', async () => {
    const id = await repo.add({ date: '2026-08-18', weightKg: 79.1 })
    await repo.update(id, { weightKg: 78.9 })
    expect((await repo.getAll())[0].weightKg).toBe(78.9)

    await repo.delete(id)
    expect(await repo.getAll()).toHaveLength(0)
  })

  it('filters by date range', async () => {
    await repo.add({ date: '2026-08-01', weightKg: 81 })
    await repo.add({ date: '2026-08-10', weightKg: 80 })
    await repo.add({ date: '2026-08-18', weightKg: 79.1 })

    const inRange = await repo.getInRange('2026-08-05', '2026-08-15')
    expect(inRange.map((w) => w.date)).toEqual(['2026-08-10'])
  })

  it('getLatest returns the most recent weigh-in', async () => {
    await repo.add({ date: '2026-08-01', weightKg: 81 })
    await repo.add({ date: '2026-08-18', weightKg: 79.1 })
    expect((await repo.getLatest())?.weightKg).toBe(79.1)
  })
})
