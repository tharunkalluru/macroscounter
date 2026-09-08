import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BitewiseDB } from '../../data/db'
import { clearLocalSyncedData, signOutLocally } from './guestMode'

let db: BitewiseDB
beforeEach(async () => {
  db = new BitewiseDB(`guest-safety-${Math.random()}`)
  await db.syncMeta.add({ userId: 'user-a', linkedUserId: 'user-a', lastSyncedAt: 1 } as never)
  await db.profiles.add({ name: 'Private name' } as never)
  await db.logEntries.add({ name: 'Private diary' } as never)
})
afterEach(async () => { await db.delete() })

describe('sign-out privacy and offline safety', () => {
  it('removes backed-up private rows and identity from the browser on signout', async () => {
    await signOutLocally(db)
    expect(await db.profiles.count()).toBe(0)
    expect(await db.logEntries.count()).toBe(0)
    expect(await db.syncMeta.count()).toBe(0)
  })

  it('refuses account replacement when unsynced edits would be lost', async () => {
    await db.syncOutbox.add({ table: 'logEntries', clientId: 'pending', operation: 'delete', payload: null, updatedAt: 1 })
    await expect(clearLocalSyncedData(db)).rejects.toThrow('changes waiting to sync')
    expect(await db.profiles.count()).toBe(1)
    expect(await db.logEntries.count()).toBe(1)
    expect(await db.syncOutbox.count()).toBe(1)
  })
})
