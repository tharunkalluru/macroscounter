import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Shell Persona' })
}

test('bottom tab bar navigates across Today, Log, Trends, Coach; Settings is reached from the avatar', async ({ page }) => {
  await onboard(page)

  await expect(page.getByTestId('bottom-tab-bar')).toBeVisible()

  await page.getByTestId('tab-log').click()
  await expect(page).toHaveURL('/log')
  await expect(page.getByTestId('log-tab-meals')).toHaveAttribute('aria-selected', 'true')
  await page.getByTestId('log-tab-month').click()
  await expect(page.getByTestId('calendar-grid')).toBeVisible()

  await page.getByTestId('tab-trends').click()
  await expect(page).toHaveURL('/trends')
  await expect(page.getByTestId('trends-card-weight')).toBeVisible()

  await page.getByTestId('tab-coach').click()
  await expect(page).toHaveURL('/coach')
  await expect(page.getByTestId('coach-placeholder')).toBeVisible()

  await page.getByTestId('avatar-link').click()
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
  await expect(page.getByRole('heading', { name: 'Add to Breakfast' })).toBeVisible()

  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await expect(page.getByTestId('entry-preview')).toContainText('41 kcal')
  await page.getByTestId('log-entry-button').click()

  await expect(page.getByTestId('bottom-sheet')).not.toBeVisible()
  // Data refreshed without a page reload (dataVersion bump).
  await expect(page.getByTestId('figure-eaten').locator('p').first()).toHaveText('41')
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
