import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Entry Detail Persona' })
}

test('tapping a food-database entry shows an editable serving size, pre-filled with its current grams', async ({
  page,
}) => {
  await onboard(page)

  await page.getByTestId('fab-scan').click() // 02:00 fixed clock -> defaults to breakfast
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByTestId('log-entry-button').click() // 40g default portion -> 41 kcal

  await page.getByRole('button', { name: 'Edit Idli' }).click()
  await expect(page.getByTestId('bottom-sheet')).toBeVisible()
  await expect(page.getByTestId('bottom-sheet')).toContainText('Idli')
  await expect(page.getByTestId('portion-grams-input')).toHaveValue('40')
  await expect(page.getByTestId('entry-preview')).toContainText('41 kcal')

  // A "Edit name or food" escape hatch still reaches the full form.
  await page.getByTestId('entry-detail-edit-button').click()
  await expect(page.getByTestId('bottom-sheet')).not.toBeVisible()
  await expect(page.getByTestId('portion-grams-input')).toBeVisible()
})

test('editing the serving size in the detail sheet recomputes and saves the other macros', async ({ page }) => {
  await onboard(page)

  await page.getByTestId('fab-scan').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByTestId('portion-grams-input').fill('40')
  await page.getByTestId('log-entry-button').click() // 40g -> 41 kcal

  await expect(page.getByTestId('figure-eaten').locator('p').first()).toHaveText('41')

  await page.getByRole('button', { name: 'Edit Idli' }).click()
  await page.getByTestId('portion-grams-input').fill('80')
  await expect(page.getByTestId('entry-preview')).toContainText('82 kcal') // 102.5 kcal/100g * 80g
  await page.getByTestId('log-entry-button').click()

  await expect(page.getByTestId('bottom-sheet')).not.toBeVisible()
  await expect(page.getByTestId('figure-eaten').locator('p').first()).toHaveText('82')

  // Re-opening shows the saved 80g, not the original 40g.
  await page.getByRole('button', { name: 'Edit Idli' }).click()
  await expect(page.getByTestId('portion-grams-input')).toHaveValue('80')
})

test('the entry detail sheet offers a servings toggle for foods with known portions', async ({ page }) => {
  await onboard(page)

  await page.getByTestId('fab-scan').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByTestId('log-entry-button').click() // 40g default -> 41 kcal

  await page.getByRole('button', { name: 'Edit Idli' }).click()
  await page.getByTestId('entry-edit-mode-servings').click()

  // Idli has two known portions ("1 idli" = 40g, "2 idli" = 80g) -- defaults
  // to the first, at a count of 1, matching the already-logged 40g.
  await expect(page.getByTestId('entry-servings-portion-0')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('entry-preview')).toContainText('41 kcal')

  await page.getByTestId('entry-servings-portion-1').click() // "2 idli" -> 80g
  await expect(page.getByTestId('entry-preview')).toContainText('82 kcal') // 102.5 kcal/100g * 80g
  await page.getByTestId('log-entry-button').click()

  await expect(page.getByTestId('bottom-sheet')).not.toBeVisible()
  await expect(page.getByTestId('figure-eaten').locator('p').first()).toHaveText('82')

  // Re-opening shows the saved servings selection, not grams.
  await page.getByRole('button', { name: 'Edit Idli' }).click()
  await expect(page.getByTestId('entry-edit-mode-servings')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('entry-servings-portion-1')).toHaveAttribute('aria-pressed', 'true')
})

test('tapping a custom quick-add entry shows its macros, then Edit opens the quick-add form pre-filled', async ({
  page,
}) => {
  await onboard(page)

  await page.getByTestId('fab-scan').click()
  await page.getByTestId('sheet-custom-button').click()
  await expect(page).toHaveURL(/\/log\/quick-add/)
  await page.getByPlaceholder('e.g. Restaurant meal').fill('Restaurant meal')
  await page.getByLabel('Calories (kcal)').fill('600')
  await page.getByLabel('Protein (g)').fill('30')
  await page.getByLabel('Carbs (g)').fill('60')
  await page.getByLabel('Fat (g)').fill('20')
  await page.getByRole('button', { name: /^Add to/ }).click()

  await page.getByRole('button', { name: 'Edit Restaurant meal' }).click()
  await expect(page.getByTestId('bottom-sheet')).toContainText('Restaurant meal')
  await expect(page.getByTestId('entry-detail-content')).toContainText('600 kcal')

  await page.getByTestId('entry-detail-edit-button').click()
  await expect(page).toHaveURL(/\/log\/quick-add\?entryId=/)
  await expect(page.getByPlaceholder('e.g. Restaurant meal')).toHaveValue('Restaurant meal')
  await expect(page.getByLabel('Calories (kcal)')).toHaveValue('600')
})
