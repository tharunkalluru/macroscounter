import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Entry Detail Persona' })
}

test('tapping a food-database entry shows its macro breakdown, then Edit opens the portion form', async ({
  page,
}) => {
  await onboard(page)

  await page.getByTestId('fab-scan').click() // 02:00 fixed clock -> defaults to breakfast
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByTestId('log-entry-button').click()

  await page.getByRole('button', { name: 'Edit Idli' }).click()
  await expect(page.getByTestId('bottom-sheet')).toBeVisible()
  await expect(page.getByTestId('bottom-sheet')).toContainText('Idli')
  await expect(page.getByTestId('entry-detail-content')).toContainText('kcal')
  await expect(page.getByTestId('entry-detail-content')).toContainText('Protein')
  await expect(page.getByTestId('entry-detail-content')).toContainText('Carbs')
  await expect(page.getByTestId('entry-detail-content')).toContainText('Fat')

  await page.getByTestId('entry-detail-edit-button').click()
  await expect(page.getByTestId('bottom-sheet')).not.toBeVisible()
  await expect(page.getByTestId('portion-grams-input')).toBeVisible()
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
