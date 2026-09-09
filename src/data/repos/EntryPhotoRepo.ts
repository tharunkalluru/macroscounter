import type { BitewiseDB } from '../db'
import { db as defaultDb } from '../db'
import type { EntryPhoto } from '../models'

/** Device-local photos attached to logged entries — see EntryPhoto's own doc comment for why these never sync. */
export class EntryPhotoRepo {
  constructor(private db: BitewiseDB = defaultDb) {}

  async attach(entryId: number, photo: Blob, mediaType: string): Promise<number> {
    return this.db.entryPhotos.add({ entryId, photo, mediaType, createdAt: new Date().toISOString() })
  }

  async getForEntry(entryId: number): Promise<EntryPhoto | undefined> {
    return this.db.entryPhotos.where('entryId').equals(entryId).first()
  }

  async deleteForEntry(entryId: number): Promise<void> {
    await this.db.entryPhotos.where('entryId').equals(entryId).delete()
  }
}
