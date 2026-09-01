import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Favorites Persona' })
}

test('marking a search result as a favorite surfaces it in the Favorites chip row', async ({ page }) => {
  await onboard(page)
  await page.getByTestId('fab-scan').click() // 02:00 fixed clock -> defaults to breakfast

  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('sambar')
  const results = page.getByTestId('search-results')
  const sambarRow = results.locator('li').filter({ hasText: 'Sambar', hasNotText: 'Drumstick' })
  await expect(sambarRow).toBeVisible()

  await sambarRow.getByRole('button', { name: 'Add Sambar to favorites' }).click()

  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('')
  await expect(page.getByText('FAVORITES')).toBeVisible()
  const favoriteChip = page.getByTestId(/favorite-toggle-/).first()
  await expect(favoriteChip).toHaveAttribute('aria-label', /Remove Sambar/)
})

test('unfavoriting removes it from the Favorites chip row', async ({ page }) => {
  await onboard(page)
  await page.getByTestId('fab-scan').click()

  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('sambar')
  const results = page.getByTestId('search-results')
  const sambarRow = results.locator('li').filter({ hasText: 'Sambar', hasNotText: 'Drumstick' })
  await sambarRow.getByRole('button', { name: 'Add Sambar to favorites' }).click()
  await expect(sambarRow.getByRole('button', { name: 'Remove Sambar from favorites' })).toBeVisible()

  await sambarRow.getByRole('button', { name: 'Remove Sambar from favorites' }).click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('')
  await expect(page.getByText('FAVORITES')).not.toBeVisible()
})
