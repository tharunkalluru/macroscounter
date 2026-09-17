import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BitewiseDB } from '../../data/db'
import type { Profile, Targets } from '../../data/models'
import { TargetRepo } from '../../data/repos/TargetRepo'
import { saveSetup } from './saveSetup'
let db: BitewiseDB
const profile: Profile = { name: 'Ari', sex: 'female', age: 30, heightCm: 165, weightKg: 65, goal: 'maintain', activityLevel: 'light' }
const target: Targets = { effectiveDate: '2026-09-16', kcal: 2000, proteinG: 117, carbsG: 250, fatG: 46, source: 'computed' }
beforeEach(() => { db = new BitewiseDB(`setup-${Math.random()}`) })
afterEach(async () => { vi.restoreAllMocks(); await db.delete() })
it('persists a usable profile and target together', async () => {
  await saveSetup(profile, target, db)
  expect(await db.profiles.count()).toBe(1)
  expect((await db.targets.toArray())[0].kcal).toBe(2000)
})
it('rolls back the profile when target persistence fails, then safely retries', async () => {
  const spy = vi.spyOn(TargetRepo.prototype, 'add').mockRejectedValueOnce(new Error('storage unavailable'))
  await expect(saveSetup(profile, target, db)).rejects.toThrow('storage unavailable')
  expect(await db.profiles.count()).toBe(0)
  expect(await db.targets.count()).toBe(0)
  expect(await db.syncOutbox.count()).toBe(0)
  spy.mockRestore()
  await saveSetup(profile, target, db)
  expect(await db.profiles.count()).toBe(1)
  expect(await db.targets.count()).toBe(1)
})
