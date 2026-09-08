// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as schema from '../../drizzle/schema'
import { accountWriteLock, mutationQueries } from './_queries'
import { aiBudgetQuery } from '../_aiBudget'
import { validateMutation } from './_validation'

const handles = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('../_auth.js', () => ({ getUserId: vi.fn(async (req: VercelRequest) => req.headers['test-user'] ?? null) }))
vi.mock('../_db.js', async () => ({ getDb: () => handles.db, schema: await import('../../drizzle/schema') }))
import pull from './pull'
import push from './push'

const pg = new PGlite()
const dialect = new PgDialect()
const clock = Date.now() - 10000
const id = '00000000-0000-4000-8000-000000000001'
const otherId = '00000000-0000-4000-8000-000000000002'
const log = { date: '2026-09-01', meal: 'breakfast', name: 'Oats', qty: 100, unit: 'grams', grams: 100, portionSummary: '100 g', kcal: 120, p: 5, c: 20, f: 2, fiber: 4, loggedAt: '2026-09-01T08:00:00.000Z' }
const product = { barcode: '1234567890123', name: 'Yogurt', per100g: { kcal: 80, p: 8, c: 7, f: 2 }, firstScanned: '2026-09-01', source: 'manual' }

async function mutate(user: string, table: string, clientId: string, payload: unknown, updatedAt = clock, operation = 'upsert') {
  const mutation = validateMutation({ table, clientId, payload, updatedAt, operation })
  expect(mutation, `Valid ${table} fixture`).not.toBeNull()
  await pg.transaction(async (tx) => {
    for (const statement of [accountWriteLock(user), ...mutationQueries(user, mutation!)]) {
      const query = dialect.sqlToQuery(statement)
      await tx.query(query.sql, query.params)
    }
  })
}
function response() {
  const res = { statusCode: 0, body: null as unknown, setHeader: vi.fn(), status: vi.fn(), json: vi.fn() }
  res.status.mockImplementation((code: number) => { res.statusCode = code; return res })
  res.json.mockImplementation((body: unknown) => { res.body = body; return res })
  return res
}
async function pullPage(user: string, query: Record<string, string> = {}) {
  const res = response()
  await pull({ method: 'GET', headers: { 'test-user': user }, query } as unknown as VercelRequest, res as unknown as VercelResponse)
  expect(res.statusCode).toBe(200)
  return res.body as { tables: Record<string, Record<string, unknown>[]>; pulledAt: number; nextCursor: string | null }
}

beforeAll(async () => {
  for (const file of readdirSync(resolve('drizzle/migrations')).filter((name) => name.endsWith('.sql')).sort()) {
    await pg.exec(readFileSync(resolve('drizzle/migrations', file), 'utf8'))
  }
  handles.db = drizzle(pg, { schema })
  await pg.exec(`INSERT INTO "user" (id, name, email) VALUES ('alice', 'Alice', 'alice@example.test'), ('bob', 'Bob', 'bob@example.test');`)
}, 60000)
afterAll(async () => { await pg.close() })
beforeEach(async () => {
  await pg.exec('TRUNCATE log_entries, scanned_products, sync_tombstones, recipes, profiles, targets, weigh_ins, meal_templates')
})

describe('sync against isolated PostgreSQL', () => {
  it('applies all migrations and prevents a second tenant taking over an existing UUID', async () => {
    await mutate('alice', 'logEntries', id, log)
    await mutate('bob', 'logEntries', id, { ...log, name: 'Intruder' }, clock + 1)
    const { rows } = await pg.query<{ user_id: string; name: string }>('SELECT user_id, name FROM log_entries')
    expect(rows).toEqual([{ user_id: 'alice', name: 'Oats' }])
    expect((await pullPage('bob')).tables.logEntries).toBeUndefined()
  })
  it('allows two users to scan the same barcode independently', async () => {
    await mutate('alice', 'scannedProducts', product.barcode, product)
    await mutate('bob', 'scannedProducts', product.barcode, { ...product, name: 'Bob yogurt' })
    const { rows } = await pg.query('SELECT * FROM scanned_products')
    expect(rows).toHaveLength(2)
    expect((await pullPage('alice')).tables.scannedProducts[0].name).toBe('Yogurt')
  })
  it('rejects stale writes and equal-clock retries without changing the server winner', async () => {
    await mutate('alice', 'logEntries', id, { ...log, name: 'Newer' }, clock + 100)
    await mutate('alice', 'logEntries', id, log, clock)
    await mutate('alice', 'logEntries', id, { ...log, name: 'Tie' }, clock + 100)
    expect((await pg.query<{ name: string }>('SELECT name FROM log_entries')).rows[0].name).toBe('Newer')
  })
  it('a delete arriving before an offline insert still prevents resurrection, while newer undo works', async () => {
    await mutate('alice', 'logEntries', id, null, clock + 100, 'delete')
    await mutate('alice', 'logEntries', id, log, clock)
    expect((await pg.query('SELECT * FROM log_entries')).rows).toHaveLength(0)
    expect((await pullPage('alice')).tables.logEntries[0].deletedAt).toBe(clock + 100)
    await mutate('alice', 'logEntries', id, log, clock + 200)
    expect((await pullPage('alice')).tables.logEntries).toHaveLength(1)
    expect((await pullPage('alice')).tables.logEntries[0].deletedAt).toBeNull()
  })
  it('discovers an offline write from days ago using its server arrival time', async () => {
    const checkpoint = await pullPage('alice')
    await mutate('alice', 'logEntries', id, log, clock - 7 * 86400000)
    await new Promise((resolve) => setTimeout(resolve, 5))
    const changes = await pullPage('alice', { since: String(checkpoint.pulledAt - 1) })
    expect(changes.tables.logEntries[0].clientId).toBe(id)
  })
  it('preserves ISO loggedAt using the actual timestamp encoder', async () => {
    await mutate('alice', 'logEntries', id, log)
    const rows = (await pullPage('alice')).tables.logEntries
    expect(new Date(rows[0].loggedAt as string).toISOString()).toBe(log.loggedAt)
  })
  it('pages a large diary without gaps, duplicates or cross-account cursors', async () => {
    await pg.query(`INSERT INTO log_entries (id,user_id,date,meal,name,qty,unit,grams,portion_summary,kcal,p,c,f,updated_at)
      SELECT ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,'alice','2026-09-01','breakfast','Food',100,'grams',100,'100 g',120,5,20,2,now() FROM generate_series(1,205) i`)
    const first = await pullPage('alice')
    expect(first.tables.logEntries).toHaveLength(200)
    expect(first.nextCursor).toBeTruthy()
    const second = await pullPage('alice', { cursor: first.nextCursor! })
    expect(second.pulledAt).toBe(first.pulledAt)
    expect(second.tables.logEntries).toHaveLength(5)
    expect(second.nextCursor).toBeNull()
    expect(new Set([...first.tables.logEntries, ...second.tables.logEntries].map((row) => row.clientId)).size).toBe(205)
    const denied = response()
    await pull({ method: 'GET', headers: { 'test-user': 'bob' }, query: { cursor: first.nextCursor! } } as unknown as VercelRequest, denied as unknown as VercelResponse)
    expect(denied.statusCode).toBe(400)
  })
  it('a user cannot delete another user’s entry', async () => {
    await mutate('alice', 'logEntries', otherId, log)
    await mutate('bob', 'logEntries', otherId, null, clock + 1, 'delete')
    expect((await pullPage('alice')).tables.logEntries[0].deletedAt).toBeNull()
  })
  it('enforces the combined AI budget in the database independently per account', async () => {
    await pg.exec('TRUNCATE api_usage')
    const query = dialect.sqlToQuery(aiBudgetQuery('alice', 2))
    expect((await pg.query(query.sql, query.params)).rows).toHaveLength(1)
    expect((await pg.query(query.sql, query.params)).rows).toHaveLength(1)
    expect((await pg.query(query.sql, query.params)).rows).toHaveLength(0)
    const bob = dialect.sqlToQuery(aiBudgetQuery('bob', 2))
    expect((await pg.query(bob.sql, bob.params)).rows).toHaveLength(1)
  })
  it('rejects oversized batches and changed account headers before database access', async () => {
    const res = response()
    await push({ method: 'POST', headers: { 'test-user': 'alice' }, body: { mutations: Array(101).fill({}) } } as unknown as VercelRequest, res as unknown as VercelResponse)
    expect(res.statusCode).toBe(400)
    const changed = response()
    await push({ method: 'POST', headers: { 'test-user': 'bob', 'x-sync-user-id': 'alice' }, body: { mutations: [] } } as unknown as VercelRequest, changed as unknown as VercelResponse)
    expect(changed.statusCode).toBe(409)
  })
})
