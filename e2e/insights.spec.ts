import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Insights Persona' })
}

async function seedDinnerHeavyDay(page: Page, date: string) {
  await page.evaluate((date) => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('macrodesi')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('logEntries', 'readwrite')
        const store = tx.objectStore('logEntries')
        const base = { date, name: 'Seed', portionSummary: 'seed', qty: 1, unit: 'grams', grams: 100 }
        store.add({ ...base, meal: 'breakfast', kcal: 200, p: 10, c: 20, f: 5 })
        store.add({ ...base, meal: 'lunch', kcal: 200, p: 15, c: 20, f: 5 })
        store.add({ ...base, meal: 'dinner', kcal: 900, p: 40, c: 90, f: 30 })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  }, date)
}

test('Trends surfaces a top-meal insight once one meal dominates the log', async ({ page }) => {
  await onboard(page)

  for (const date of ['2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16']) {
    await seedDinnerHeavyDay(page, date)
  }

  await page.goto('/trends/report')
  await expect(page.getByTestId('insight-top-meal')).toContainText('Dinner')
})

test('Trends shows a placeholder before enough history exists for insights', async ({ page }) => {
  await onboard(page)

  await page.goto('/trends/report')
  await expect(page.getByText('Keep logging — patterns in how you eat will show up here.')).toBeVisible()
})
