import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, eq, gt } from 'drizzle-orm'
import { getUserId } from '../_auth.js'
import { getDb, schema } from '../_db.js'

const TABLES = {
  profiles: schema.profiles,
  targets: schema.targets,
  logEntries: schema.logEntries,
  weighIns: schema.weighIns,
  recipes: schema.recipes,
  mealTemplates: schema.mealTemplates,
  scannedProducts: schema.scannedProducts,
} as const

/**
 * GET /api/sync/pull?since=<epoch-ms> — returns every row (across all
 * synced tables) for the signed-in user that changed after `since`,
 * including soft-deleted rows (deletedAt set), so the client can remove
 * them locally too. Omit `since` (or pass 0) for a full pull — the case a
 * brand-new device/cleared-IndexedDB session needs.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const userId = await getUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Not signed in' })
    return
  }

  const sinceParam = Array.isArray(req.query.since) ? req.query.since[0] : req.query.since
  const since = new Date(Number(sinceParam) || 0)

  const db = getDb()
  const result: Record<string, Record<string, unknown>[]> = {}

  for (const [tableName, table] of Object.entries(TABLES)) {
    const rows = await db
      .select()
      .from(table)
      .where(and(eq(table.userId, userId), gt(table.updatedAt, since)))

    result[tableName] = rows.map((row) => ({
      ...row,
      clientId: row.id,
      updatedAt: row.updatedAt.getTime(),
      deletedAt: row.deletedAt ? row.deletedAt.getTime() : null,
    }))
  }

  res.status(200).json({ tables: result, pulledAt: Date.now() })
}
