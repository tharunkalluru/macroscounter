import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = resolve(__dirname, '../src/domain/barcode/fixtures')
const amulButter = JSON.parse(readFileSync(resolve(fixturesDir, 'off-amul-butter.json'), 'utf-8'))
const offNotFound = JSON.parse(readFileSync(resolve(fixturesDir, 'off-not-found.json'), 'utf-8'))

async function onboard(page: Page) {
  // Dead-zone hour (00:00-4:59) so the Phase 10.3 meal prompt never fires and
  // blocks this test's own interactions -- these tests don't care what time
  // it is, they just need it to not be a live meal window.
  await page.clock.setFixedTime(new Date('2026-08-18T02:00:00'))
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()
  await page.getByPlaceholder('Your name').fill('Barcode Persona')
  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByPlaceholder('years').fill('28')
  await page.getByPlaceholder('cm').fill('170')
  await page.getByPlaceholder('kg').fill('70')
  await page.getByLabel('Activity level').selectOption('sedentary')
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL('/')
}

test('manual barcode entry finds a product via Open Food Facts and logs it', async ({ page }) => {
  await onboard(page)

  await page.route('**/api/v2/product/8901491101615.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(amulButter) })
  )

  await page.getByTestId('add-breakfast').click()
  await page.getByTestId('sheet-scan-button').click()
  await expect(page).toHaveURL(/\/scan\?meal=breakfast/)

  await page.getByPlaceholder('Enter barcode number').fill('8901491101615')
  await page.getByRole('button', { name: 'Look up' }).click()

  await expect(page).toHaveURL('/scan/product/8901491101615?meal=breakfast')
  await expect(page.getByTestId('scanned-product-name')).toHaveText('Amul Butter')
  await expect(page.getByTestId('entry-preview')).toContainText('72 kcal') // 1 serving = 10g -> 71.7 -> rounds to 72

  await page.getByTestId('log-entry-button').click()
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('meal-subtotal-breakfast')).toHaveText('72 kcal')
})

test('not-found flow: manual save persists the product, then a second scan hits cache offline', async ({
  page,
  context,
}) => {
  await onboard(page)

  let offCallCount = 0
  await page.route('**/api/v2/product/9999999999999.json', (route) => {
    offCallCount++
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(offNotFound) })
  })

  await page.getByTestId('add-lunch').click()
  await page.getByTestId('sheet-scan-button').click()
  await page.getByPlaceholder('Enter barcode number').fill('9999999999999')
  await page.getByRole('button', { name: 'Look up' }).click()

  await expect(page).toHaveURL('/scan/not-found/9999999999999?meal=lunch')
  await expect(page.getByText('9999999999999')).toBeVisible()

  await page.getByLabel('Product name').fill('Homemade Protein Bar')
  await page.getByLabel('Calories').fill('380')
  await page.getByLabel('Protein (g)').fill('25')
  await page.getByLabel('Carbs (g)').fill('40')
  await page.getByLabel('Fat (g)').fill('12')
  await page.getByRole('button', { name: 'Save & continue' }).click()

  await expect(page).toHaveURL('/scan/product/9999999999999?meal=lunch')
  await expect(page.getByTestId('scanned-product-name')).toHaveText('Homemade Protein Bar')
  await page.getByTestId('log-entry-button').click()
  await expect(page).toHaveURL('/')

  expect(offCallCount).toBe(1)

  // Second scan of the same barcode, fully offline: cache hit, no network needed.
  await context.setOffline(true)
  await page.getByTestId('add-dinner').click()
  await page.getByTestId('sheet-scan-button').click()
  await page.getByPlaceholder('Enter barcode number').fill('9999999999999')
  await page.getByRole('button', { name: 'Look up' }).click()

  await expect(page).toHaveURL('/scan/product/9999999999999?meal=dinner')
  await expect(page.getByTestId('scanned-product-name')).toHaveText('Homemade Protein Bar')
  expect(offCallCount).toBe(1) // still 1 -- no new network call was made

  await context.setOffline(false)
})
