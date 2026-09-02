import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Settings Persona' })
}

test('settings groups You, The App, and Your Data are all visible', async ({ page }) => {
  await onboard(page)
  await page.goto('/settings')

  await expect(page.getByRole('heading', { name: 'You', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'The App' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your Data' })).toBeVisible()
})

test('food source toggles default on and persist a change across reload', async ({ page }) => {
  await onboard(page)
  await page.goto('/settings')
  await page.getByTestId('settings-row-food').click()
  await expect(page).toHaveURL('/settings/food')

  const offToggle = page.getByTestId('food-source-off')
  const fdcToggle = page.getByTestId('food-source-fdc')
  await expect(offToggle).toHaveAttribute('aria-checked', 'true')
  await expect(fdcToggle).toHaveAttribute('aria-checked', 'true')

  await offToggle.click()
  await expect(offToggle).toHaveAttribute('aria-checked', 'false')

  await page.reload()
  await expect(page.getByTestId('food-source-off')).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByTestId('food-source-fdc')).toHaveAttribute('aria-checked', 'true')
})

test('delete account & data is present but disabled', async ({ page }) => {
  await onboard(page)
  await page.goto('/settings')

  const deleteButton = page.getByTestId('delete-account-button')
  await expect(deleteButton).toBeVisible()
  await expect(deleteButton).toBeDisabled()
})
