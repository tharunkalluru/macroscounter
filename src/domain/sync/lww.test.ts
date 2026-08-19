import { describe, expect, it } from 'vitest'
import { mergeRemoteRows, resolveLWW } from './lww'
import type { SyncRow } from './types'

function row(overrides: Partial<SyncRow> = {}): SyncRow {
  return { clientId: 'row-1', updatedAt: 1000, deletedAt: null, name: 'local', ...overrides }
}

describe('resolveLWW', () => {
  it('returns the remote row when there is no local copy', () => {
    const remote = row({ name: 'remote' })
    expect(resolveLWW(undefined, remote)).toBe(remote)
  })

  it('returns the remote row when it is strictly newer', () => {
    const local = row({ updatedAt: 1000, name: 'local' })
    const remote = row({ updatedAt: 2000, name: 'remote' })
    expect(resolveLWW(local, remote)).toBe(remote)
  })

  it('returns the local row when it is strictly newer', () => {
    const local = row({ updatedAt: 2000, name: 'local' })
    const remote = row({ updatedAt: 1000, name: 'remote' })
    expect(resolveLWW(local, remote)).toBe(local)
  })

  it('breaks an exact-timestamp tie in favor of remote', () => {
    const local = row({ updatedAt: 1000, name: 'local' })
    const remote = row({ updatedAt: 1000, name: 'remote' })
    expect(resolveLWW(local, remote)).toBe(remote)
  })

  it('a soft-deleted remote row still wins if newer (propagates the delete)', () => {
    const local = row({ updatedAt: 1000, deletedAt: null })
    const remote = row({ updatedAt: 2000, deletedAt: 2000 })
    expect(resolveLWW(local, remote)).toBe(remote)
  })

  it('a stale soft-deleted remote row loses to a newer local edit (undelete wins)', () => {
    const local = row({ updatedAt: 3000, deletedAt: null })
    const remote = row({ updatedAt: 2000, deletedAt: 2000 })
    expect(resolveLWW(local, remote)).toBe(local)
  })
})

describe('mergeRemoteRows', () => {
  it('adds remote rows the local table has never seen', () => {
    const result = mergeRemoteRows([], [row({ clientId: 'new-row' })])
    expect(result).toHaveLength(1)
    expect(result[0].clientId).toBe('new-row')
  })

  it('updates a local row when the remote copy is newer', () => {
    const local = [row({ clientId: 'a', updatedAt: 1000, name: 'old' })]
    const remote = [row({ clientId: 'a', updatedAt: 2000, name: 'new' })]
    const result = mergeRemoteRows(local, remote)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('new')
  })

  it('keeps the local row when it is newer than the remote copy', () => {
    const local = [row({ clientId: 'a', updatedAt: 2000, name: 'newer-local' })]
    const remote = [row({ clientId: 'a', updatedAt: 1000, name: 'stale-remote' })]
    const result = mergeRemoteRows(local, remote)
    expect(result[0].name).toBe('newer-local')
  })

  it('leaves local rows with no remote counterpart in this batch untouched', () => {
    const local = [row({ clientId: 'untouched', name: 'stays' })]
    const result = mergeRemoteRows(local, [])
    expect(result).toEqual(local)
  })

  it('merges a batch of several rows independently', () => {
    const local = [
      row({ clientId: 'a', updatedAt: 1000, name: 'local-a' }),
      row({ clientId: 'b', updatedAt: 3000, name: 'local-b' }),
    ]
    const remote = [
      row({ clientId: 'a', updatedAt: 2000, name: 'remote-a' }),
      row({ clientId: 'b', updatedAt: 2000, name: 'remote-b' }),
      row({ clientId: 'c', updatedAt: 2000, name: 'remote-c' }),
    ]
    const result = mergeRemoteRows(local, remote)
    const byId = new Map(result.map((r) => [r.clientId, r.name]))
    expect(byId.get('a')).toBe('remote-a') // remote newer
    expect(byId.get('b')).toBe('local-b') // local newer
    expect(byId.get('c')).toBe('remote-c') // new row
  })
})
