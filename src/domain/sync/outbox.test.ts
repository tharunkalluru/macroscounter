import { describe, expect, it } from 'vitest'
import { enqueueMutation, reconcileAfterPush } from './outbox'
import type { OutboxEntry } from './types'

function entry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    table: 'logEntries',
    clientId: 'abc-123',
    operation: 'upsert',
    payload: { name: 'Idli' },
    updatedAt: 1000,
    ...overrides,
  }
}

describe('enqueueMutation', () => {
  it('appends a new entry when nothing is queued for that row yet', () => {
    const result = enqueueMutation([], entry())
    expect(result).toHaveLength(1)
    expect(result[0].clientId).toBe('abc-123')
  })

  it('collapses a second mutation for the same row into one entry', () => {
    const first = enqueueMutation([], entry({ updatedAt: 1000, payload: { name: 'Idli' } }))
    const second = enqueueMutation(
      first,
      entry({ updatedAt: 2000, payload: { name: 'Idli (edited)' } })
    )
    expect(second).toHaveLength(1)
    expect(second[0].updatedAt).toBe(2000)
    expect(second[0].payload).toEqual({ name: 'Idli (edited)' })
  })

  it('keeps the original outbox id when collapsing, so the Dexie row is updated in place', () => {
    const first = enqueueMutation([], { ...entry(), id: 7 })
    const second = enqueueMutation(first, entry({ updatedAt: 2000 }))
    expect(second[0].id).toBe(7)
  })

  it('does not collapse mutations for different rows in the same table', () => {
    const withFirst = enqueueMutation([], entry({ clientId: 'a' }))
    const withBoth = enqueueMutation(withFirst, entry({ clientId: 'b' }))
    expect(withBoth).toHaveLength(2)
  })

  it('does not collapse mutations for the same clientId in different tables', () => {
    const withFirst = enqueueMutation([], entry({ table: 'logEntries', clientId: 'x' }))
    const withBoth = enqueueMutation(withFirst, entry({ table: 'weighIns', clientId: 'x' }))
    expect(withBoth).toHaveLength(2)
  })

  it('a delete mutation collapses over a prior upsert for the same row', () => {
    const withUpsert = enqueueMutation([], entry({ operation: 'upsert', updatedAt: 1000 }))
    const withDelete = enqueueMutation(
      withUpsert,
      entry({ operation: 'delete', payload: null, updatedAt: 2000 })
    )
    expect(withDelete).toHaveLength(1)
    expect(withDelete[0].operation).toBe('delete')
    expect(withDelete[0].payload).toBeNull()
  })
})

describe('reconcileAfterPush', () => {
  it('removes an entry whose updatedAt matches what was successfully pushed', () => {
    const outbox = [entry({ updatedAt: 1000 })]
    const result = reconcileAfterPush(outbox, [
      { table: 'logEntries', clientId: 'abc-123', updatedAt: 1000 },
    ])
    expect(result).toEqual([])
  })

  it('keeps an entry that mutated again after the pushed snapshot was taken', () => {
    // Simulates: push started with updatedAt=1000, but a new edit queued at
    // 1500 before the push response came back.
    const outbox = [entry({ updatedAt: 1500 })]
    const result = reconcileAfterPush(outbox, [
      { table: 'logEntries', clientId: 'abc-123', updatedAt: 1000 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].updatedAt).toBe(1500)
  })

  it('leaves entries untouched when nothing in the flushed batch matches them', () => {
    const outbox = [entry({ clientId: 'unrelated' })]
    const result = reconcileAfterPush(outbox, [
      { table: 'logEntries', clientId: 'abc-123', updatedAt: 1000 },
    ])
    expect(result).toEqual(outbox)
  })

  it('reconciles multiple entries independently', () => {
    const outbox = [
      entry({ clientId: 'a', updatedAt: 1000 }),
      entry({ clientId: 'b', updatedAt: 2000 }),
    ]
    const result = reconcileAfterPush(outbox, [
      { table: 'logEntries', clientId: 'a', updatedAt: 1000 },
      { table: 'logEntries', clientId: 'b', updatedAt: 2000 },
    ])
    expect(result).toEqual([])
  })

  it('returns an empty outbox unchanged', () => {
    expect(reconcileAfterPush([], [{ table: 'logEntries', clientId: 'a', updatedAt: 1 }])).toEqual([])
  })
})
