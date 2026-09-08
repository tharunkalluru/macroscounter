import type { VercelResponse } from '@vercel/node'
import { sql } from 'drizzle-orm'
import { getDb, schema } from './_db.js'

export function aiBudgetQuery(userId: string, limit: number) {
  const table = schema.apiUsage
  return sql`insert into ${table} (user_id, bucket, count)
    values (${userId}, date_trunc('day', now() at time zone 'UTC') at time zone 'UTC', 1)
    on conflict (user_id, bucket) do update set count = ${table.count} + 1
    where ${table.count} < ${limit} returning count`
}

/** Count before calling the model; failed provider requests also consume budget. */
export async function allowAiRequest(userId: string, res: VercelResponse): Promise<boolean> {
  const configured = Number(process.env.AI_DAILY_REQUEST_LIMIT ?? 100)
  const limit = Number.isSafeInteger(configured) && configured > 0 ? Math.min(configured, 10000) : 100
  const result = await getDb().execute(aiBudgetQuery(userId, limit))
  if (result.rows.length) return true
  res.setHeader?.('Retry-After', String(Math.ceil((Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1) - Date.now()) / 1000)))
  res.status(429).json({ error: 'Your daily AI limit has been reached. You can still search foods, scan barcodes, and log manually. AI resets at midnight UTC.', code: 'daily_limit' })
  return false
}
