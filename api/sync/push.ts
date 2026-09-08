import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserId } from '../_auth.js'
import { getDb } from '../_db.js'
import { accountWriteLock, mutationQueries } from './_queries.js'
import { MAX_MUTATIONS, MAX_PUSH_BYTES, validateMutation } from './_validation.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader?.('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
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
    const contentType = req.headers['content-type']
    if (contentType && !contentType.includes('application/json')) {
      res.status(415).json({ error: 'Use application/json.' })
      return
    }
    const raw: unknown = req.body?.mutations
    if (!Array.isArray(raw) || raw.length > MAX_MUTATIONS) {
      res.status(400).json({ error: `mutations must be an array of at most ${MAX_MUTATIONS} items` })
      return
    }
    if (Buffer.byteLength(JSON.stringify(req.body), 'utf8') > MAX_PUSH_BYTES) {
      res.status(413).json({ error: 'Sync batch is too large.' })
      return
    }
    const rejected: { index: number; table?: unknown; clientId?: unknown; updatedAt?: unknown; code: string }[] = []
    const mutations = raw.flatMap((value, index) => {
      const valid = validateMutation(value)
      if (valid) return [valid]
      const row = value && typeof value === 'object' ? value : {}
      rejected.push({ index, table: row.table, clientId: row.clientId, updatedAt: row.updatedAt, code: 'invalid_mutation' })
      return []
    })
    if (mutations.length) {
      const db = getDb()
      // Neon HTTP batches execute as one transaction; the account lock and
      // durable tombstones cover out-of-order requests as well as duplicates.
      const queries = [accountWriteLock(userId), ...mutations.flatMap((mutation) => mutationQueries(userId, mutation))]
      const operations = queries.map((query) => db.execute(query))
      await db.batch(operations as [typeof operations[number], ...typeof operations[number][]])
    }
    // Stale/equal writes are consumed too: the following pull carries the
    // server winner. Retrying a losing version forever cannot resolve it.
    const flushed = mutations.map(({ table, clientId, updatedAt }) => ({ table, clientId, updatedAt }))
    res.status(200).json({ flushed, rejected })
  } catch (error) {
    // Never log nutrition payloads, credentials, or database query parameters.
    console.error('sync push failed', { name: error instanceof Error ? error.name : 'UnknownError' })
    res.status(503).json({ error: 'Cloud sync is temporarily unavailable. Your changes stay on this device.', code: 'sync_unavailable' })
  }
}
