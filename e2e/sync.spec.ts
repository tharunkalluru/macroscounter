import { expect, type Page, type Route } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

const TEST_USER_ID = 'sync-e2e-user-1'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Sync Persona' })
}

// Stand-in for a signed-in session: Phase 10.2 will set this row via a real
// Google OAuth round-trip. Until then, writing it directly to IndexedDB is
// the legitimate way to drive the sync engine's signed-in code path in an
// E2E test — same technique the other specs use to seed fixture data.
async function signIn(page: Page, userId: string) {
  await page.evaluate((uid) => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('macrodesi')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('syncMeta', 'readwrite')
        const store = tx.objectStore('syncMeta')
        // `onboard()` already went through the "Skip for now" guest flow,
        // which wrote its own syncMeta row — clear it first so the signed-in
        // row added below is unambiguously the one `.first()` (the app's own
        // lookup, keyed on insertion order) picks up.
        store.clear()
        store.add({
          userId: uid,
          userEmail: 'sync-e2e@example.com',
          userName: 'Sync Persona',
          userAvatarUrl: null,
          lastSyncedAt: null,
        })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  }, userId)
}

async function logEntryCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    return new Promise<number>((resolve, reject) => {
      const req = indexedDB.open('macrodesi')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('logEntries', 'readonly')
        const countReq = tx.objectStore('logEntries').count()
        countReq.onsuccess = () => resolve(countReq.result)
        countReq.onerror = () => reject(countReq.error)
      }
      req.onerror = () => reject(req.error)
    })
  })
}

/** In-memory stand-in for the Neon-backed /api/sync/* routes, scoped to one test. */
function createMockSyncServer() {
  const tables = new Map<string, Map<string, Record<string, unknown>>>()

  function tableFor(name: string) {
    let t = tables.get(name)
    if (!t) {
      t = new Map()
      tables.set(name, t)
    }
    return t
  }

  async function handlePush(route: Route) {
    const body = route.request().postDataJSON() as {
      mutations: { table: string; clientId: string; operation: string; payload: Record<string, unknown> | null; updatedAt: number }[]
    }
    const flushed: { table: string; clientId: string; updatedAt: number }[] = []
    for (const m of body.mutations) {
      const t = tableFor(m.table)
      const existing = t.get(m.clientId)
      if (existing && (existing.updatedAt as number) > m.updatedAt) continue
      if (m.operation === 'delete') {
        t.set(m.clientId, { ...(existing ?? {}), clientId: m.clientId, deletedAt: m.updatedAt, updatedAt: m.updatedAt })
      } else if (m.payload) {
        t.set(m.clientId, { ...m.payload, clientId: m.clientId, updatedAt: m.updatedAt, deletedAt: null })
      }
      flushed.push({ table: m.table, clientId: m.clientId, updatedAt: m.updatedAt })
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ flushed }) })
  }

  async function handlePull(route: Route) {
    const url = new URL(route.request().url())
    const since = Number(url.searchParams.get('since') ?? '0')
    const result: Record<string, Record<string, unknown>[]> = {}
    for (const [tableName, rows] of tables) {
      result[tableName] = [...rows.values()].filter((r) => (r.updatedAt as number) > since)
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tables: result, pulledAt: Date.now() }),
    })
  }

  async function install(page: Page) {
    await page.route('**/api/sync/push', handlePush)
    await page.route('**/api/sync/pull*', handlePull)
  }

  function rowCount(tableName: string): number {
    return tableFor(tableName).size
  }

  return { install, rowCount }
}

test('log offline, go online, entries appear from a fresh (cleared-IndexedDB) session after sync', async ({
  page,
  context,
}) => {
  const server = createMockSyncServer()
  await server.install(page)

  await onboard(page)
  await signIn(page, TEST_USER_ID)
  await context.setOffline(true)

  await page.getByTestId('fab-scan').click() // 02:00 fixed clock -> defaults to breakfast
  await expect(page.getByTestId('bottom-sheet')).toBeVisible()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByTestId('portion-grams-input').fill('120')
  await page.getByTestId('log-entry-button').click()
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('figure-eaten').locator('p').first()).toHaveText('123')

  // Instant local write, unaffected by the network being down. Logging
  // bumps `dataVersion`, which triggers SyncTriggers' opportunistic sync
  // attempt — it should see the browser is offline and back off cleanly.
  expect(await logEntryCount(page)).toBe(1)
  expect(server.rowCount('logEntries')).toBe(0)
  await page.getByTestId('avatar-link').click()
  await expect(page.getByTestId('sync-status')).toContainText('Offline', { timeout: 5_000 })

  await context.setOffline(false)
  // Chromium fires window 'online' on its own once the CDP-level offline
  // emulation lifts, but dispatch it explicitly too so the assertion below
  // isn't racing an event the browser may coalesce or delay.
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByTestId('sync-status')).toContainText('Synced', { timeout: 10_000 })
  expect(server.rowCount('logEntries')).toBe(1)

  await page.evaluate(() => indexedDB.deleteDatabase('macrodesi'))
  await page.reload()

  // Fresh device, same account: the local cache is empty but the account is
  // still authenticated (Phase 10.2's session cookie will restore this
  // automatically; here we re-seed it the same way we signed in above).
  await signIn(page, TEST_USER_ID)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))

  await expect
    .poll(() => logEntryCount(page), { timeout: 10_000, message: 'entry should reappear after pull' })
    .toBe(1)
})
