import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { onboard } from './helpers/onboard'
import type { LogEntry } from '../src/data/models'

const SHAKE = 'Ultra Complete Chocolate Protein Shake, 30 g protein, ready to drink, 325 ml bottle'
const BARCODE = '8901491101622'

async function readEntries(page: Page): Promise<LogEntry[]> {
  return page.evaluate(() => new Promise<LogEntry[]>((resolve, reject) => {
    const request = indexedDB.open('macrodesi')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const query = database.transaction('logEntries').objectStore('logEntries').getAll()
      query.onsuccess = () => { database.close(); resolve(query.result) }
      query.onerror = () => { database.close(); reject(query.error) }
    }
  }))
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

test('a long scanned name stays exact through review, diary details and repeating on another day', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 })
  await onboard(page)
  await page.route(`**/api/v2/product/${BARCODE}.json`, (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      status: 1,
      product: { product_name: SHAKE, brands: 'Ultra Complete', serving_size: '325 ml', nutriments: {
        'energy-kcal_100g': 49.2, proteins_100g: 9.2, carbohydrates_100g: 1.5, fat_100g: 0.6,
        'energy-kcal_serving': 160, proteins_serving: 30, carbohydrates_serving: 5, fat_serving: 2,
      } },
    }),
  }))
  await page.goto(`/scan/product/${BARCODE}?meal=breakfast&date=2026-08-17`)
  await expect(page.getByTestId('scanned-product-name')).toHaveText('Protein shake')
  await page.getByTestId('food-name-details').locator('summary').click()
  await expect(page.getByTestId('food-full-name')).toHaveText(SHAKE)
  await expectNoOverflow(page)
  await page.getByTestId('log-entry-button').click()
  await expect(page).toHaveURL('/log?date=2026-08-17')
  await expect(page.getByTestId('entry-display-name')).toHaveText('Protein shake')
  await page.locator('button[data-testid^="entry-row-"]').click()
  await expect(page.getByTestId('entry-full-name')).toHaveText(SHAKE)
  await expect(page.getByTestId('entry-detail-content')).toContainText(BARCODE)
  await expectNoOverflow(page)
  await page.keyboard.press('Escape')

  const original = (await readEntries(page))[0]
  expect(original).toMatchObject({ name: SHAKE, barcode: BARCODE, kcal: 160, p: 30, grams: 325 })
  await page.goto('/')
  const suggestion = page.getByTestId('repeat-meals-card').getByTestId('meal-suggestion-row')
  await expect(suggestion.getByTestId('meal-suggestion-title')).toHaveText('Protein shake')
  const toggle = suggestion.getByTestId('meal-suggestion-details-toggle')
  await toggle.focus()
  await page.keyboard.press('Enter')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(suggestion.getByTestId('meal-suggestion-details')).toContainText(SHAKE)
  expect(await readEntries(page)).toHaveLength(1)
  await expectNoOverflow(page)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
  await page.screenshot({ path: test.info().outputPath('repeat-full-name-mobile.png'), fullPage: true })
  await suggestion.getByTestId('repeat-meal').click()
  await expect(page.getByTestId('today-entry-list')).toContainText('Protein shake')
  const saved = (await readEntries(page)).find((entry) => entry.date === '2026-08-18')
  expect(saved).toMatchObject({ name: SHAKE, barcode: BARCODE, kcal: 160, p: 30, c: 5, f: 2, grams: 325 })
  await page.reload()
  await expect(page.getByTestId('today-entry-list')).toContainText('Protein shake')
  expect((await readEntries(page)).find((entry) => entry.date === '2026-08-18')?.name).toBe(SHAKE)
})

test('AI review preserves full editable names and unfamiliar names remain inspectable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await onboard(page)
  await page.route('**/api/auth/get-session', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      session: { id: 'name-session', userId: 'name-reviewer', expiresAt: '2099-01-01T00:00:00Z' },
      user: { id: 'name-reviewer', email: 'review@example.test', name: 'Reviewer', emailVerified: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    }),
  }))
  const unfamiliar = 'Grandmother’s traditional family dish with an unfamiliar regional name ' + 'x'.repeat(100)
  await page.route('**/api/ai/analyze', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ items: [
      { name: SHAKE, gramsEstimate: 325, kcal: 160, proteinG: 30, carbsG: 5, fatG: 2, fiberG: 0, confidence: 'high' },
      { name: unfamiliar, gramsEstimate: 250, kcal: 350, proteinG: 15, carbsG: 50, fatG: 10, fiberG: 5, confidence: 'low' },
    ] }),
  }))
  await page.goto('/log/ai?meal=lunch&date=2026-08-17')
  await page.getByTestId('ai-description-input').fill('A chocolate protein shake and my family dish')
  await page.getByTestId('ai-analyse-button').click()
  await expect(page.getByTestId('ai-result-list')).toBeVisible()
  await page.getByTestId('food-name-details').first().locator('summary').click()
  await expect(page.getByTestId('food-full-name').first()).toHaveText(SHAKE)
  await expectNoOverflow(page)
  await page.getByTestId('ai-log-all-button').click()
  await expect(page).toHaveURL('/log?date=2026-08-17')
  const entries = await readEntries(page)
  expect(entries.map((entry) => entry.name)).toEqual([SHAKE, unfamiliar])
  expect(entries[0].customSnapshot?.name).toBe(SHAKE)
  await page.locator('button[data-testid^="entry-row-"]').nth(1).click()
  await expect(page.getByTestId('entry-full-name')).toHaveText(unfamiliar)
  await expectNoOverflow(page)
  await page.keyboard.press('Escape')
  await page.goto('/log/usuals?meal=lunch&date=2026-08-18')
  const suggestion = page.getByTestId('meal-suggestion-row')
  await suggestion.getByTestId('meal-suggestion-details-toggle').click()
  await expect(suggestion.getByTestId('meal-suggestion-details')).toContainText(SHAKE)
  await expect(suggestion.getByTestId('meal-suggestion-details')).toContainText(unfamiliar)
  expect(await readEntries(page)).toHaveLength(2)
  await expectNoOverflow(page)
  await suggestion.getByTestId('usuals-item').click()
  await expect(page.getByRole('status')).toContainText('Meal added')
  const copies = (await readEntries(page)).filter((entry) => entry.date === '2026-08-18')
  expect(copies.map((entry) => entry.name)).toEqual([SHAKE, unfamiliar])
  expect(copies.map((entry) => entry.kcal)).toEqual([160, 350])
})
