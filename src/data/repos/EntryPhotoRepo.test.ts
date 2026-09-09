import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BitewiseDB } from '../db'
import { EntryPhotoRepo } from './EntryPhotoRepo'

let db: BitewiseDB
let repo: EntryPhotoRepo

beforeEach(() => {
  db = new BitewiseDB(`test-entry-photo-${Math.random()}`)
  repo = new EntryPhotoRepo(db)
})

afterEach(async () => {
  await db.delete()
})

describe('EntryPhotoRepo', () => {
  // Note: fake-indexeddb's structured-clone shim under jsdom doesn't
  // preserve jsdom's own Blob class through a round trip (it comes back as
  // a plain object) -- a test-harness limitation, not a real one: native
  // IndexedDB in every real browser clones Blobs (and their `.type`)
  // correctly, which is exactly why `mediaType` is also stored explicitly
  // (see EntryPhoto's doc comment) rather than only trusted to survive on
  // the Blob itself. This test asserts what jsdom can actually prove —
  // storage keys and the explicit field -- not Blob byte fidelity.
  it('attaches a photo to an entry and reads it back', async () => {
    const blob = new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' })
    await repo.attach(42, blob, 'image/jpeg')

    const found = await repo.getForEntry(42)
    expect(found?.entryId).toBe(42)
    expect(found?.mediaType).toBe('image/jpeg')
    expect(found?.photo).toBeDefined()
  })

  it('returns undefined for an entry with no photo', async () => {
    expect(await repo.getForEntry(999)).toBeUndefined()
  })

  it('deletes the photo(s) for an entry', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' })
    await repo.attach(1, blob, 'image/jpeg')
    await repo.deleteForEntry(1)
    expect(await repo.getForEntry(1)).toBeUndefined()
  })
})
