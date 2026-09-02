import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = resolve(__dirname, '../src/domain/barcode/fixtures')
const multipackBiscuits = JSON.parse(readFileSync(resolve(fixturesDir, 'off-multipack-biscuits.json'), 'utf-8'))
const britanniaGoodDay = JSON.parse(readFileSync(resolve(fixturesDir, 'off-britannia-goodday.json'), 'utf-8'))

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

  await page.getByTestId('fab-scan').click() // 02:00 fixed clock -> defaults to breakfast
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
  await expect(page.getByTestId('figure-eaten').locator('p').first()).not.toHaveText('0')
})

test('logging a servings-mode product still records fiber even when the source declares per-serving macros but not per-serving fiber', async ({
  page,
}) => {
  await onboard(page)
  // Real-world OFF gap: this fixture has fiber_100g (1.5) but no
  // fiber_serving, alongside a full per-serving kcal/protein/carbs/fat
  // (which is what puts ServingPortionStep into per-serving mode in the
  // first place) -- fiber must be derived from per100g x grams instead of
  // silently dropped just because the other three macros came from the
  // source's own per-serving figures.
  await page.route('**/api/v2/product/8901063114074.json', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(britanniaGoodDay) })
  )

  await page.getByTestId('fab-scan').click()
  await page.getByTestId('sheet-scan-button').click()
  await page.getByPlaceholder('Enter barcode number').fill('8901063114074')
  await page.getByRole('button', { name: 'Look up' }).click()

  await expect(page.getByTestId('scanned-product-name')).toHaveText('Good Day Cashew Cookies')
  await expect(page.getByTestId('portion-servings-input')).toHaveValue('1')
  await page.getByTestId('log-entry-button').click()

  await expect(page).toHaveURL('/')
  // 1.5g fiber/100g * 30g serving = 0.45 -> rounds to 1g displayed.
  await expect(page.getByTestId('fiber-bar-value')).toContainText('1 /')
})
