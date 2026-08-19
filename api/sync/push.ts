import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, and } from 'drizzle-orm'
import { getUserId } from '../_auth'
import { getDb, schema } from '../_db'

const TABLES = {
  profiles: schema.profiles,
  targets: schema.targets,
  logEntries: schema.logEntries,
  weighIns: schema.weighIns,
  recipes: schema.recipes,
  mealTemplates: schema.mealTemplates,
  scannedProducts: schema.scannedProducts,
} as const

type TableKey = keyof typeof TABLES

interface PushMutation {
  table: string
  clientId: string
  operation: 'upsert' | 'delete'
  payload: Record<string, unknown> | null
  updatedAt: number
}

function isKnownTable(name: string): name is TableKey {
  return Object.prototype.hasOwnProperty.call(TABLES, name)
}

/**
 * POST /api/sync/push — accepts a batch of queued local mutations (the
 * client's outbox) and applies them with last-write-wins: a mutation is
 * only applied if it's newer than (or equal to — first-write case) whatever
 * the server currently has for that row. Returns which mutations were
 * accepted so the client can safely drop them from its own outbox.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const userId = getUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Not signed in' })
    return
  }

  const mutations = (req.body?.mutations ?? []) as PushMutation[]
  if (!Array.isArray(mutations)) {
    res.status(400).json({ error: 'mutations must be an array' })
    return
  }

  const db = getDb()
  const flushed: { table: string; clientId: string; updatedAt: number }[] = []

  for (const mutation of mutations) {
    if (!isKnownTable(mutation.table)) continue
    const table = TABLES[mutation.table]

    const existing = await db
      .select({ updatedAt: table.updatedAt })
      .from(table)
      .where(and(eq(table.id, mutation.clientId), eq(table.userId, userId)))
      .limit(1)

    const serverUpdatedAt = existing[0]?.updatedAt?.getTime()
    if (serverUpdatedAt !== undefined && serverUpdatedAt > mutation.updatedAt) {
      // Server already has something newer (a race with another device) —
      // skip; the client will pick up the winner on its next pull.
      continue
    }

    if (mutation.operation === 'delete') {
      await db
        .update(table)
        .set({ deletedAt: new Date(mutation.updatedAt), updatedAt: new Date(mutation.updatedAt) })
        .where(and(eq(table.id, mutation.clientId), eq(table.userId, userId)))
    } else if (mutation.payload) {
      const { id: _clientPayloadId, updatedAt: _clientUpdatedAt, deletedAt: _clientDeletedAt, ...rest } =
        mutation.payload
      const row = {
        ...rest,
        id: mutation.clientId,
        userId,
        updatedAt: new Date(mutation.updatedAt),
        deletedAt: null,
      }
      await db
        .insert(table)
        .values(row as never)
        .onConflictDoUpdate({ target: table.id, set: row as never })
    }

    flushed.push({ table: mutation.table, clientId: mutation.clientId, updatedAt: mutation.updatedAt })
  }

  res.status(200).json({ flushed })
}
