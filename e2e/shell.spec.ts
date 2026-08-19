import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'

async function onboard(page: Page) {
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()
  await page.getByPlaceholder('Your name').fill('Shell Persona')
  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByPlaceholder('years').fill('28')
  await page.getByPlaceholder('cm').fill('170')
  await page.getByPlaceholder('kg').fill('70')
  await page.getByLabel('Activity level').selectOption('sedentary')
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL('/')
}

test('bottom tab bar navigates across Today, History, Trends, Settings', async ({ page }) => {
  await onboard(page)

  await expect(page.getByTestId('bottom-tab-bar')).toBeVisible()

  await page.getByTestId('tab-history').click()
  await expect(page).toHaveURL('/history')
  await expect(page.getByTestId('calendar-grid')).toBeVisible()

  await page.getByTestId('tab-trends').click()
  await expect(page).toHaveURL('/trends')
  await expect(page.getByTestId('weight-chart').or(page.getByText('Weight'))).toBeVisible()

  await page.getByTestId('tab-settings').click()
  await expect(page).toHaveURL('/settings')

  await page.getByTestId('tab-today').click()
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('date-nav-label')).toHaveText(/Today/)
})

test('FAB opens the Add Food sheet, logging closes it and updates totals', async ({ page }) => {
  await onboard(page)

  await expect(page.getByTestId('bottom-sheet')).not.toBeVisible()
  await page.getByTestId('fab-scan').click()
  await expect(page.getByTestId('bottom-sheet')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Add food' })).toBeVisible()

  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await expect(page.getByTestId('entry-preview')).toContainText('41 kcal')
  await page.getByRole('button', { name: /Add to/ }).click()

  await expect(page.getByTestId('bottom-sheet')).not.toBeVisible()
  // Data refreshed without a page reload (dataVersion bump).
  const mealKey = await page
    .locator('[data-testid^="meal-subtotal-"]')
    .filter({ hasText: '41 kcal' })
    .first()
  await expect(mealKey).toBeVisible()
})

test('closing the Add Food sheet via the close button dismisses it without saving', async ({ page }) => {
  await onboard(page)

  await page.getByTestId('fab-scan').click()
  await expect(page.getByTestId('bottom-sheet')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByTestId('bottom-sheet')).not.toBeVisible()
})

test('past-day view shows "Return to today" and returns correctly', async ({ page }) => {
  await onboard(page)

  await expect(page.getByTestId('return-to-today')).not.toBeVisible()

  await page.getByTestId('date-nav').getByRole('button', { name: 'Previous day' }).click()
  await expect(page.getByTestId('date-nav-label')).toHaveText(/Yesterday/)
  await expect(page.getByTestId('return-to-today')).toBeVisible()

  await page.getByTestId('return-to-today').click()
  await expect(page.getByTestId('date-nav-label')).toHaveText(/Today/)
  await expect(page.getByTestId('return-to-today')).not.toBeVisible()
})

test('the barcode icon inside the Add Food sheet header opens the scanner', async ({ page }) => {
  await onboard(page)

  await page.getByTestId('fab-scan').click()
  await page.getByTestId('sheet-scan-button').click()
  await expect(page).toHaveURL(/\/scan\?meal=/)
})
