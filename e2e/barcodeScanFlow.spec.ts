import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = resolve(__dirname, '../src/domain/barcode/fixtures')
const multipackBiscuits = JSON.parse(readFileSync(resolve(fixturesDir, 'off-multipack-biscuits.json'), 'utf-8'))

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date('2026-08-18T02:00:00'))
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()
  await page.getByPlaceholder('Your name').fill('Barcode Flow Persona')
  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByPlaceholder('years').fill('28')
  await page.getByPlaceholder('cm').fill('170')
  await page.getByPlaceholder('kg').fill('70')
  await page.getByLabel('Activity level').selectOption('sedentary')
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL('/')
}

// Torch-toggle rendering and the 5s-no-decode manual-entry fallback are
// covered at the component level instead (src/app/ScanPage.test.tsx) —
// faking a genuinely *decoding* camera stream in a headless E2E browser
// (real video frames, real BarcodeDetector timing) is unreliably flaky,
// while jsdom + a stubbed getUserMedia/BarcodeDetector exercises the exact
// same component logic deterministically.
test('the product card shows brand, image, and per-100g summary, prefilled with the detected serving grams', async ({
  page,
}) => {
  await onboard(page)
  await page.route('**/api/v2/product/8901030811234.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(multipackBiscuits) })
  )

  await page.getByTestId('add-lunch').click()
  await page.getByTestId('sheet-scan-button').click()
  await page.getByPlaceholder('Enter barcode number').fill('8901030811234')
  await page.getByRole('button', { name: 'Look up' }).click()

  await expect(page.getByTestId('scanned-product-name')).toHaveText('Parle-G Multipack Biscuits')
  await expect(page.getByText('Parle', { exact: true })).toBeVisible()
  await expect(page.getByTestId('scanned-product-image')).toBeVisible()
  await expect(page.getByText(/Per 100 g: 462 kcal/)).toBeVisible()

  // Detected serving_size "40 g" pre-fills the field.
  await expect(page.getByTestId('portion-grams-input')).toHaveValue('40')
  // The "2 x 40 g" quantity produces "1 pack" (80g) / "½ pack" (40g) chips.
  await expect(page.getByText('1 pack ≈ 80 g')).toBeVisible()

  await page.getByTestId('log-entry-button').click()
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('meal-subtotal-lunch')).not.toHaveText('0 kcal')
})
