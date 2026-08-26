import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = resolve(__dirname, '../src/domain/barcode/fixtures')
const multipackBiscuits = JSON.parse(readFileSync(resolve(fixturesDir, 'off-multipack-biscuits.json'), 'utf-8'))

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Barcode Flow Persona' })
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

  // Detected serving_size "40 g" defaults the entry to 1 serving, not a raw grams field.
  await expect(page.getByTestId('portion-servings-input')).toHaveValue('1')
  await expect(page.getByText('1 serving = 40 g')).toBeVisible()

  // "Enter grams manually" reaches the pack-based gram shortcuts from the
  // "2 x 40 g" quantity ("1 pack" = 80g / "½ pack" = 40g), for anyone who'd
  // rather log by pack than by serving count.
  await page.getByTestId('switch-to-grams-link').click()
  await expect(page.getByTestId('portion-grams-input')).toHaveValue('40')
  await expect(page.getByText('1 pack ≈ 80 g')).toBeVisible()

  await page.getByTestId('log-entry-button').click()
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('meal-subtotal-lunch')).not.toHaveText('0 kcal')
})
