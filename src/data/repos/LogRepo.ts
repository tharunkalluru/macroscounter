import { trackDelete, trackUpsert } from '../../lib/sync/syncTracker'
import type { BitewiseDB } from '../db'
import { db as defaultDb } from '../db'
import type { LogEntry } from '../models'

export class LogRepo {
  constructor(private db: BitewiseDB = defaultDb) {}

  async addEntry(entry: Omit<LogEntry, 'id'>): Promise<number> {
    return (await this.addEntries([entry]))[0]
  }

  /** The visible diary and its backup queue commit together, including copied meals. */
  async addEntries(entries: Omit<LogEntry, 'id'>[]): Promise<number[]> {
    return this.db.transaction('rw', [this.db.logEntries, this.db.syncMeta, this.db.syncOutbox], async () => {
      const ids: number[] = []
      for (const entry of entries) {
        const withLoggedAt = { loggedAt: new Date().toISOString(), ...entry }
        const id = await this.db.logEntries.add(withLoggedAt as LogEntry)
        await trackUpsert(this.db, 'logEntries', id, { ...withLoggedAt, id })
        ids.push(id)
      }
      return ids
    })
  }

  async updateEntry(id: number, changes: Partial<Omit<LogEntry, 'id'>>): Promise<void> {
    await this.db.transaction('rw', [this.db.logEntries, this.db.syncMeta, this.db.syncOutbox], async () => {
      await this.db.logEntries.update(id, changes)
      const updated = await this.db.logEntries.get(id)
      if (updated) await trackUpsert(this.db, 'logEntries', id, updated)
    })
  }

  async deleteEntry(id: number): Promise<void> {
    await this.db.transaction('rw', [this.db.logEntries, this.db.syncMeta, this.db.syncOutbox], async () => {
      const existing = await this.db.logEntries.get(id)
      await this.db.logEntries.delete(id)
      if (existing) await trackDelete(this.db, 'logEntries', existing.clientId, existing.updatedAt)
    })
  }

  async getById(id: number): Promise<LogEntry | undefined> {
    return this.db.logEntries.get(id)
  }

  async getEntriesForDate(date: string): Promise<LogEntry[]> {
    return this.db.logEntries.where('date').equals(date).toArray()
  }

  async getEntriesForDateRange(startDate: string, endDate: string): Promise<LogEntry[]> {
    return this.db.logEntries.where('date').between(startDate, endDate, true, true).toArray()
  }

  async getRecentFoodIds(limit = 30): Promise<string[]> {
    const entries = await this.db.logEntries.orderBy('date').reverse().toArray()
    const seen: string[] = []
    for (const entry of entries) {
      if (entry.foodId && !seen.includes(entry.foodId)) {
        seen.push(entry.foodId)
        if (seen.length >= limit) break
      }
    }
    return seen
  }

  async getRecentBarcodes(limit = 30): Promise<string[]> {
    const entries = await this.db.logEntries.orderBy('date').reverse().toArray()
    const seen: string[] = []
    for (const entry of entries) {
      if (entry.barcode && !seen.includes(entry.barcode)) {
        seen.push(entry.barcode)
        if (seen.length >= limit) break
      }
    }
    return seen
  }
}
