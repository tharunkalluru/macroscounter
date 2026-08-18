import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MacroDesiDB } from '../db'
import type { Targets } from '../models'
import { TargetRepo } from './TargetRepo'

const target = (overrides: Partial<Targets> = {}): Omit<Targets, 'id'> => ({
  effectiveDate: '2026-08-18',
  kcal: 1800,
  proteinG: 140,
  carbsG: 150,
  fatG: 55,
  source: 'computed',
  ...overrides,
})

let db: MacroDesiDB
let repo: TargetRepo

beforeEach(() => {
  db = new MacroDesiDB(`test-target-${Math.random()}`)
  repo = new TargetRepo(db)
})

afterEach(async () => {
  await db.delete()
})

describe('TargetRepo', () => {
  it('returns undefined when no targets exist', async () => {
    expect(await repo.getLatest()).toBeUndefined()
  })

  it('getLatest returns the target with the most recent effectiveDate', async () => {
    await repo.add(target({ effectiveDate: '2026-08-01', kcal: 1700 }))
    await repo.add(target({ effectiveDate: '2026-08-18', kcal: 1800 }))
    await repo.add(target({ effectiveDate: '2026-08-10', kcal: 1750 }))

    const latest = await repo.getLatest()
    expect(latest?.effectiveDate).toBe('2026-08-18')
    expect(latest?.kcal).toBe(1800)
  })

  it('getAll returns targets ordered by effectiveDate ascending', async () => {
    await repo.add(target({ effectiveDate: '2026-08-18' }))
    await repo.add(target({ effectiveDate: '2026-08-01' }))

    const all = await repo.getAll()
    expect(all.map((t) => t.effectiveDate)).toEqual(['2026-08-01', '2026-08-18'])
  })
})
