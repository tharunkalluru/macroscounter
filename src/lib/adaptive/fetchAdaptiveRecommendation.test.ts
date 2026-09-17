import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchAdaptiveRecommendation } from './fetchAdaptiveRecommendation'
import { acceptAdaptiveRecommendation } from './acceptAdaptiveRecommendation'
import { addDaysISO, todayISO } from '../date'

const mocks = vi.hoisted(() => ({ profile: vi.fn(), targets: vi.fn(), entries: vi.fn(), weighIns: vi.fn(), add: vi.fn() }))
vi.mock('../../data/repos/ProfileRepo', () => ({ ProfileRepo: class { get = mocks.profile } }))
vi.mock('../../data/repos/TargetRepo', () => ({ TargetRepo: class { getAll = mocks.targets; add = mocks.add } }))
vi.mock('../../data/repos/LogRepo', () => ({ LogRepo: class { getEntriesForDateRange = mocks.entries } }))
vi.mock('../../data/repos/WeighInRepo', () => ({ WeighInRepo: class { getInRange = mocks.weighIns } }))

beforeEach(() => {
  vi.clearAllMocks()
  const today = todayISO()
  mocks.profile.mockResolvedValue({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, goal: 'cut' })
  mocks.targets.mockResolvedValue([
    { effectiveDate: addDaysISO(today, -7), kcal: 2100, proteinG: 200, fatG: 140, carbsG: 10, source: 'computed' },
    { effectiveDate: addDaysISO(today, 5), kcal: 3000, proteinG: 100, fatG: 70, carbsG: 400, source: 'computed' },
  ])
  mocks.entries.mockResolvedValue(Array.from({ length: 7 }, (_, index) => ({ date: addDaysISO(today, -6 + index), kcal: 2100, p: 100, c: 200, f: 90 })))
  mocks.weighIns.mockResolvedValue([{ date: addDaysISO(today, -6), weightKg: 80 }, { date: today, weightKg: 80 }])
  mocks.add.mockResolvedValue(1)
})

describe('adaptive plan consistency', () => {
  it('uses the current applicable target and preserves existing protein/fat calories through proposal and save', async () => {
    const { recommendation } = await fetchAdaptiveRecommendation()
    expect(recommendation).toMatchObject({ currentKcal: 2100, suggestedKcal: 2060, adjustment: -40 })
    await acceptAdaptiveRecommendation(recommendation!)
    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ kcal: 2060, proteinG: 200, fatG: 140, carbsG: 0 }))
  })
  it('retains a no-change maintenance review instead of recommending weight loss', async () => {
    mocks.profile.mockResolvedValue({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, goal: 'maintain' })
    const result = await fetchAdaptiveRecommendation()
    expect(result.recommendation).toBeNull()
    expect(result.review?.adjustment).toBe(0)
    expect(result.review?.reason).toContain('maintenance goal')
  })
  it('refuses a stale or incompatible proposal rather than saving conflicting numbers', async () => {
    const { recommendation } = await fetchAdaptiveRecommendation()
    await expect(acceptAdaptiveRecommendation({ ...recommendation!, suggestedKcal: 1900 })).rejects.toThrow('protein and fat')
    await expect(acceptAdaptiveRecommendation({ ...recommendation!, currentKcal: 2300 })).rejects.toThrow('plan changed')
    expect(mocks.add).not.toHaveBeenCalled()
  })
})
