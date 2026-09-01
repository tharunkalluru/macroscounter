import { expect, type Locator, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function swipeToDelete(page: Page, row: Locator) {
  await row.scrollIntoViewIfNeeded()
  const box = await row.boundingBox()
  if (!box) throw new Error('row not found for swipe-to-delete')
  const startX = box.x + box.width - 20
  const startY = box.y + box.height / 2
  // Dispatch real pointer events directly rather than simulating OS-level
  // mouse movement: framer-motion's drag gesture needs several distinct
  // pointermove events (with real time between them, and staying within the
  // row's -120px drag constraint) before it registers as a drag rather than
  // a click, and coordinate-based mouse simulation proved unreliable at
  // hitting that window reliably in a headless browser.
  const pointerInit = (x: number) => ({
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: x,
    clientY: startY,
  })
  await row.dispatchEvent('pointerdown', pointerInit(startX))
  for (let i = 1; i <= 7; i++) {
    await row.dispatchEvent('pointermove', pointerInit(startX - i * 15))
    await page.waitForTimeout(16)
  }
  await row.dispatchEvent('pointerup', { ...pointerInit(startX - 105), buttons: 0 })
}

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Journey Persona' })
}

// Fixture persona: kcal target 1628 (see goalEngine.test.ts). Logging 3 idli
// (120g -> 123 kcal / 5.4p / 24c / 0.6f) + 1 katori sambar (150g -> 93 kcal /
// 4.5p / 12c / 3f) for breakfast = 216 kcal / 9.9p / 36c / 3.6f total.
test('full journey: onboard, search idli, log 3 idli + sambar for breakfast, ring/bars update exactly, reload persists', async ({
  page,
}) => {
  await onboard(page)

  await page.getByTestId('fab-scan').click() // 02:00 fixed clock -> defaults to breakfast
  await expect(page.getByTestId('bottom-sheet')).toBeVisible()

  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  // Idli's typical portion (40g) pre-fills the grams field; type the total
  // grams for 3 idli (120g) directly, replacing the pre-focused default.
  await page.getByTestId('portion-grams-input').fill('120')
  await expect(page.getByTestId('entry-preview')).toContainText('123 kcal')
  await page.getByTestId('log-entry-button').click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('kcal-remaining')).toHaveText('1505') // 1628 - 123
  await expect(page.getByTestId('protein-bar-value')).toHaveText('5 / 126 g')

  await page.getByTestId('fab-scan').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('sambhar')
  await page.getByTestId('search-results').getByRole('button', { name: 'Sambar', exact: true }).click()
  // Sambar's typical portion is already 1 katori = 150g, matching the fixture exactly.
  await expect(page.getByTestId('entry-preview')).toContainText('93 kcal')
  await page.getByTestId('log-entry-button').click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('kcal-remaining')).toHaveText('1412') // 1628 - 216
  await expect(page.getByTestId('protein-bar-value')).toHaveText('10 / 126 g')
  await expect(page.getByTestId('carbs-bar-value')).toHaveText('36 / 171 g')
  await expect(page.getByTestId('fat-bar-value')).toHaveText('4 / 49 g')

  await page.goto('/log') // meal-grouped breakdown lives on the Log tab's Meals view (Phase R.3)
  await expect(page.getByTestId('meal-subtotal-breakfast')).toHaveText('216 kcal')

  await page.reload()
  await expect(page.getByTestId('meal-subtotal-breakfast')).toHaveText('216 kcal')

  await page.goto('/')
  await expect(page.getByTestId('kcal-remaining')).toHaveText('1412')
})

test('offline logging: once seeded, adding a food entry works entirely without network', async ({
  page,
  context,
}) => {
  await onboard(page)

  await context.setOffline(true)

  await page.getByTestId('fab-scan').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('chicken curry')
  await page.getByTestId('search-results').getByRole('button', { name: 'Chicken Curry', exact: true }).click()
  await page.getByTestId('log-entry-button').click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('figure-eaten').locator('p').first()).not.toHaveText('0')

  await context.setOffline(false)
})

test('editing quantity and deleting an entry update the day totals', async ({ page }) => {
  await onboard(page)

  await page.getByTestId('fab-scan').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  // Idli's typical portion (40g) is already the pre-filled default.
  await page.getByTestId('log-entry-button').click()

  await expect(page.getByTestId('figure-eaten').locator('p').first()).toHaveText('41') // 1 idli (40g), 102.5*0.4=41

  await page.getByRole('button', { name: 'Edit Idli' }).click()
  await page.getByTestId('portion-grams-input').fill('80')
  await page.getByTestId('log-entry-button').click()
  await expect(page.getByTestId('figure-eaten').locator('p').first()).toHaveText('82') // 2 idli (80g), 102.5*0.8=82

  await swipeToDelete(page, page.getByRole('button', { name: 'Edit Idli' }))
  await expect(page.getByTestId('figure-eaten').locator('p').first()).toHaveText('0')
})
