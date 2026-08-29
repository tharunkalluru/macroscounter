import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Copy Yesterday Persona' })
}

async function seedLogEntry(
  page: Page,
  entry: {
    date: string
    meal: string
    foodId: string
    name: string
    portionSummary: string
    portionLabel: string
    qty: number
    unit: string
    grams: number
    kcal: number
    p: number
    c: number
    f: number
  }
) {
  await page.evaluate((e) => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('macrodesi')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('logEntries', 'readwrite')
        tx.objectStore('logEntries').add(e)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  }, entry)
}

test('an empty today with a logged yesterday offers a one-tap whole-day copy', async ({ page }) => {
  await onboard(page) // pins the clock to 2026-08-18T02:00 (see onboard())

  await seedLogEntry(page, {
    date: '2026-08-17',
    meal: 'breakfast',
    foodId: 'idli',
    name: 'Idli',
    portionSummary: '3 x 1 idli',
    portionLabel: '1 idli',
    qty: 3,
    unit: 'portion',
    grams: 120,
    kcal: 123,
    p: 5.4,
    c: 24,
    f: 0.6,
  })
  await seedLogEntry(page, {
    date: '2026-08-17',
    meal: 'dinner',
    foodId: 'idli',
    name: 'Idli',
    portionSummary: '2 x 1 idli',
    portionLabel: '1 idli',
    qty: 2,
    unit: 'portion',
    grams: 80,
    kcal: 82,
    p: 3.6,
    c: 16,
    f: 0.4,
  })
  await page.reload()

  const prompt = page.getByTestId('copy-yesterday-prompt')
  await expect(prompt).toBeVisible()
  await expect(prompt).toContainText('2 items, 205 kcal')

  await page.getByTestId('copy-yesterday-confirm').click()

  await expect(prompt).not.toBeVisible()
  await expect(page.getByTestId('meal-subtotal-breakfast')).toHaveText('123 kcal')
  await expect(page.getByTestId('meal-subtotal-dinner')).toHaveText('82 kcal')
})

test('no prompt appears when yesterday has nothing to copy', async ({ page }) => {
  await onboard(page)
  await expect(page.getByTestId('copy-yesterday-prompt')).not.toBeVisible()
})

test('dismiss hides the prompt without copying anything', async ({ page }) => {
  await onboard(page)

  await seedLogEntry(page, {
    date: '2026-08-17',
    meal: 'lunch',
    foodId: 'idli',
    name: 'Idli',
    portionSummary: '1 x 1 idli',
    portionLabel: '1 idli',
    qty: 1,
    unit: 'portion',
    grams: 40,
    kcal: 41,
    p: 1.8,
    c: 8,
    f: 0.2,
  })
  await page.reload()

  await expect(page.getByTestId('copy-yesterday-prompt')).toBeVisible()
  await page.getByTestId('copy-yesterday-dismiss').click()
  await expect(page.getByTestId('copy-yesterday-prompt')).not.toBeVisible()
  await expect(page.getByTestId('meal-subtotal-lunch')).toHaveText('0 kcal')
})

test('the prompt does not appear once something has been logged today', async ({ page }) => {
  await onboard(page)

  await seedLogEntry(page, {
    date: '2026-08-17',
    meal: 'lunch',
    foodId: 'idli',
    name: 'Idli',
    portionSummary: '1 x 1 idli',
    portionLabel: '1 idli',
    qty: 1,
    unit: 'portion',
    grams: 40,
    kcal: 41,
    p: 1.8,
    c: 8,
    f: 0.2,
  })
  await seedLogEntry(page, {
    date: '2026-08-18',
    meal: 'breakfast',
    foodId: 'idli',
    name: 'Idli',
    portionSummary: '1 x 1 idli',
    portionLabel: '1 idli',
    qty: 1,
    unit: 'portion',
    grams: 40,
    kcal: 41,
    p: 1.8,
    c: 8,
    f: 0.2,
  })
  await page.reload()

  await expect(page.getByTestId('copy-yesterday-prompt')).not.toBeVisible()
})
