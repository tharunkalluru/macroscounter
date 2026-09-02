import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BitewiseDB } from '../db'
import type { Profile } from '../models'
import { ProfileRepo } from './ProfileRepo'

const sampleProfile: Profile = {
  name: 'Tharun',
  sex: 'male',
  age: 30,
  heightCm: 175,
  weightKg: 80,
  activityLevel: 'moderate',
  goal: 'cut',
}

let db: BitewiseDB
let repo: ProfileRepo

beforeEach(() => {
  db = new BitewiseDB(`test-profile-${Math.random()}`)
  repo = new ProfileRepo(db)
})

afterEach(async () => {
  await db.delete()
})

describe('ProfileRepo', () => {
  it('returns undefined when no profile exists', async () => {
    expect(await repo.get()).toBeUndefined()
  })

  it('saves and retrieves a profile', async () => {
    await repo.save(sampleProfile)
    const found = await repo.get()
    expect(found?.name).toBe('Tharun')
    expect(found?.weightKg).toBe(80)
  })

  it('save() upserts the single profile row rather than creating a second one', async () => {
    await repo.save(sampleProfile)
    await repo.save({ ...sampleProfile, weightKg: 78 })

    const all = await db.profiles.toArray()
    expect(all).toHaveLength(1)
    expect(all[0].weightKg).toBe(78)
  })
})
