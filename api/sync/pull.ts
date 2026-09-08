import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, asc, eq, gt, lte, not, or, sql } from 'drizzle-orm'
import { getUserId } from '../_auth.js'
import { getDb, schema } from '../_db.js'
import { TABLES } from './_queries.js'

export const MAX_PULL_ROWS = 200
const MAX_PULL_BYTES = 2_000_000
const tableNames = Object.keys(TABLES) as (keyof typeof TABLES)[]
interface Cursor { version: 1; table: number; after: string; since: number; until: number; userId: string }

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}
export function decodeCursor(value: string): Cursor | null {
  try {
    if (value.length > 2000) return null
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor
    if (cursor.version !== 1 || !Number.isInteger(cursor.table) || cursor.table < 0 || cursor.table > tableNames.length ||
      typeof cursor.after !== 'string' || cursor.after.length > 250 || typeof cursor.userId !== 'string' ||
      !Number.isSafeInteger(cursor.since) || cursor.since < 0 || !Number.isSafeInteger(cursor.until) || cursor.until < cursor.since) return null
    return cursor
  } catch { return null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader?.('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const userId = await getUserId(req)
    if (!userId) {
      res.status(401).json({ error: 'Not signed in' })
      return
    }
    const expectedUser = req.headers['x-sync-user-id']
    if (expectedUser && expectedUser !== userId) {
      res.status(409).json({ error: 'Account changed. Sign in again.', code: 'account_changed' })
      return
    }
    const sinceParam = req.query.since
    const cursorParam = req.query.cursor
    const since = sinceParam === undefined ? 0 : Number(sinceParam)
    if (Array.isArray(sinceParam) || !Number.isSafeInteger(since) || since < 0 || since > 8_640_000_000_000_000 || Array.isArray(cursorParam)) {
      res.status(400).json({ error: 'Invalid sync cursor.' })
      return
    }
    const db = getDb()
    let cursor: Cursor
    if (cursorParam !== undefined) {
      const parsed = decodeCursor(cursorParam)
      if (!parsed || parsed.userId !== userId || (sinceParam !== undefined && parsed.since !== since)) {
        res.status(400).json({ error: 'Invalid sync cursor.' })
        return
      }
      cursor = parsed
    } else {
      // Read the database clock before any table. Later writes fall into the
      // next snapshot even if their device created them days ago offline.
      const clock = await db.execute<{ now: number }>(sql`select floor(extract(epoch from clock_timestamp()) * 1000)::double precision as now`)
      cursor = { version: 1, table: 0, after: '', since, until: Math.max(since, Number(clock.rows[0].now)), userId }
    }
    const result: Record<string, Record<string, unknown>[]> = {}
    let count = 0
    let bytes = 0
    let nextCursor: string | null = null
    const tombstones = schema.syncTombstones
    for (let stage = cursor.table; stage <= tableNames.length; stage++) {
      const isTombstone = stage === tableNames.length
      const tableName = tableNames[stage]
      const table = isTombstone ? tombstones : TABLES[tableName]
      const after = stage === cursor.table ? cursor.after : ''
      // Obsolete delete markers must not hide a later explicit re-add.
      const newerRow = isTombstone ? or(...tableNames.map((name) => {
        const source = TABLES[name]
        return and(eq(tombstones.tableName, name), sql`exists (select 1 from ${source}
          where ${source.userId} = ${userId} and ${source.id}::text = ${tombstones.clientId}
            and ${source.updatedAt} > ${tombstones.updatedAt})`)
      })) : undefined
      const rows = await db.select().from(table).where(and(
        eq(table.userId, userId), gt(table.serverChangedAt, new Date(cursor.since)),
        lte(table.serverChangedAt, new Date(cursor.until)),
        after ? gt(table.id, after) : undefined,
        newerRow ? not(newerRow) : undefined,
      )).orderBy(asc(table.id)).limit(MAX_PULL_ROWS - count + 1)
      let lastId = after
      for (const row of rows) {
        const raw = row as Record<string, unknown>
        const destination = isTombstone ? String(raw.tableName) : tableName
        const wire = isTombstone ? {
          clientId: raw.clientId, updatedAt: (raw.updatedAt as Date).getTime(), deletedAt: (raw.updatedAt as Date).getTime(),
        } : {
          ...raw, clientId: raw.id, updatedAt: (raw.updatedAt as Date).getTime(),
          deletedAt: raw.deletedAt ? (raw.deletedAt as Date).getTime() : null,
        }
        const rowBytes = Buffer.byteLength(JSON.stringify(wire), 'utf8')
        if (count >= MAX_PULL_ROWS || (count > 0 && bytes + rowBytes > MAX_PULL_BYTES)) {
          nextCursor = encodeCursor({ ...cursor, table: stage, after: lastId })
          break
        }
        if (tableNames.includes(destination as keyof typeof TABLES)) {
          (result[destination] ??= []).push(wire)
        }
        count++
        bytes += rowBytes
        lastId = String(raw.id)
      }
      if (nextCursor) break
    }
    res.status(200).json({ tables: result, pulledAt: cursor.until, nextCursor, userId })
  } catch (error) {
    console.error('sync pull failed', { name: error instanceof Error ? error.name : 'UnknownError' })
    res.status(503).json({ error: 'Cloud sync is temporarily unavailable.', code: 'sync_unavailable' })
  }
}
