import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BitewiseDB } from './db'
import type { FoodRecord } from './models'
import { FoodRepo } from './repos/FoodRepo'
import { ensureFoodDbSeeded } from './seed'

const sampleFoods: FoodRecord[] = [
  {
    id: 'idli',
    name: 'Idli',
    aliases: ['idly'],
    category: 'south-indian',
    per100g: { kcal: 102.5, p: 4.5, c: 20, f: 0.5, fiber: 0.9 },
    portions: [{ label: '1 idli', grams: 40 }],
    source: 'test',
    verified: true,
  },
]

let db: BitewiseDB
let repo: FoodRepo

beforeEach(() => {
  db = new BitewiseDB(`test-seed-${Math.random()}`)
  repo = new FoodRepo(db)
})

afterEach(async () => {
  await db.delete()
  vi.unstubAllGlobals()
})

describe('ensureFoodDbSeeded', () => {
  it('fetches and seeds when the foods table is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleFoods,
    })
    vi.stubGlobal('fetch', fetchMock)

    await ensureFoodDbSeeded(repo)

    expect(fetchMock).toHaveBeenCalledWith('/fooddb.json')
    expect(await repo.count()).toBe(1)
  })

  it('does not fetch when already seeded (offline-safe on repeat visits)', async () => {
    await repo.seedIfEmpty(sampleFoods)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await ensureFoodDbSeeded(repo)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(await repo.count()).toBe(1)
  })

  it('throws a clear error when the fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404 })
    )
    await expect(ensureFoodDbSeeded(repo)).rejects.toThrow(/Failed to load food database/)
  })
})
