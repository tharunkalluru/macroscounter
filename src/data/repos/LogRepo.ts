import type { MacroDesiDB } from '../db'
import { db as defaultDb } from '../db'
import type { LogEntry } from '../models'

export class LogRepo {
  constructor(private db: MacroDesiDB = defaultDb) {}

  async addEntry(entry: Omit<LogEntry, 'id'>): Promise<number> {
    return this.db.logEntries.add(entry as LogEntry)
  }

  async updateEntry(id: number, changes: Partial<Omit<LogEntry, 'id'>>): Promise<void> {
    await this.db.logEntries.update(id, changes)
  }

  async deleteEntry(id: number): Promise<void> {
    await this.db.logEntries.delete(id)
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
}
