import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

// Regression coverage for a real bug found by manual UI auditing: Templates,
// Export, and the recipe builder had zero in-app links pointing to them —
// every prior E2E spec reached them via page.goto() directly, which is why
// the gap went undetected. These tests only count if they click through the
// real UI, never page.goto() the destination directly.

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Nav Persona' })
}

test('Templates and Export are reachable from Settings by clicking through the UI', async ({ page }) => {
  await onboard(page)
  await page.getByTestId('avatar-link').click()
  await expect(page).toHaveURL('/settings')

  await page.getByRole('link', { name: 'Meal templates' }).click()
  await expect(page).toHaveURL('/templates')

  await page.goBack()
  await expect(page).toHaveURL('/settings')

  await page.getByRole('link', { name: 'Export data' }).click()
  await expect(page).toHaveURL('/export')
})

test('the recipe builder is reachable from the Add Food sheet by clicking through the UI', async ({ page }) => {
  await onboard(page)
  await page.getByTestId('fab-scan').click()
  await expect(page.getByTestId('bottom-sheet')).toBeVisible()

  await page.getByTestId('sheet-new-recipe-button').click()
  await expect(page).toHaveURL('/recipes/new')
  await expect(page.getByRole('heading', { name: 'New recipe' })).toBeVisible()
})

test('the recipe builder is reachable from the full-screen Add Food page too', async ({ page }) => {
  await onboard(page)
  // The full-screen add page is used for past-day logging; reached directly
  // here (that route itself has no in-app entry point yet either, tracked
  // separately) but its own "+ New recipe" affordance must still work.
  await page.goto('/log/add?meal=breakfast')
  await page.getByTestId('page-new-recipe-button').click()
  await expect(page).toHaveURL('/recipes/new')
})
