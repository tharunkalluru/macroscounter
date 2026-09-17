import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BitewiseDB } from '../../data/db'
import { FoodRepo } from '../../data/repos/FoodRepo'
import { LogRepo } from '../../data/repos/LogRepo'
import { computeMealSuggestions } from '../../domain/logging/suggestions'
import { logSuggestionChip } from './logSuggestionChip'

let db: BitewiseDB
beforeEach(() => { db = new BitewiseDB(`repeat-meal-${Math.random()}`) })
afterEach(async () => { await db.delete() })

const original = { id: 100, clientId: 'original', date: '2026-09-10', meal: 'lunch' as const, name: 'AI bowl', qty: 1, unit: 'portion' as const, grams: 320, portionSummary: '1 bowl', kcal: 500, p: 30, c: 60, f: 15, fiber: 8 }

describe('atomic repeat logging', () => {
  it('preserves an AI meal snapshot with fresh identity on the requested historical date', async () => {
    const [chip] = computeMealSuggestions([original], 'lunch', '2026-09-12')
    const ids = await logSuggestionChip(chip, 'dinner', '2026-09-11', new LogRepo(db), new FoodRepo(db))
    const saved = await db.logEntries.get(ids[0])
    expect(saved).toMatchObject({ date: '2026-09-11', meal: 'dinner', name: 'AI bowl', grams: 320, kcal: 500, fiber: 8 })
    expect(saved?.clientId).not.toBe('original')
    expect(saved?.id).not.toBe(100)
  })
  it('does not partly save a meal if any legacy catalog item cannot be resolved', async () => {
    const [chip] = computeMealSuggestions([original], 'lunch', '2026-09-12')
    chip.entries.push({ foodId: 'missing', name: 'Missing', qty: 1, unit: 'portion', grams: 100 })
    await expect(logSuggestionChip(chip, 'lunch', '2026-09-12', new LogRepo(db), new FoodRepo(db))).rejects.toThrow('No entries were added')
    expect(await db.logEntries.count()).toBe(0)
    expect(await db.syncOutbox.count()).toBe(0)
  })
  it('rolls back every entry if the batch fails during persistence', async () => {
    const [chip] = computeMealSuggestions([original, { ...original, name: 'Other food', id: 101 }], 'lunch', '2026-09-12')
    let writes = 0
    db.logEntries.hook('creating', () => { if (++writes === 2) throw new Error('disk full') })
    await expect(logSuggestionChip(chip, 'lunch', '2026-09-12', new LogRepo(db), new FoodRepo(db))).rejects.toThrow('disk full')
    expect(await db.logEntries.count()).toBe(0)
    expect(await db.syncOutbox.count()).toBe(0)
  })
})
