import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'

async function onboard(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('Your name').fill('Journey Persona')
  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByPlaceholder('years').fill('28')
  await page.getByPlaceholder('cm').fill('170')
  await page.getByPlaceholder('kg').fill('70')
  await page.getByLabel('Activity level').selectOption('sedentary')
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL('/')
}

// Fixture persona: kcal target 1628 (see goalEngine.test.ts). Logging 3 idli
// (120g -> 123 kcal / 5.4p / 24c / 0.6f) + 1 katori sambar (150g -> 93 kcal /
// 4.5p / 12c / 3f) for breakfast = 216 kcal / 9.9p / 36c / 3.6f total.
test('full journey: onboard, search idli, log 3 idli + sambar for breakfast, ring/bars update exactly, reload persists', async ({
  page,
}) => {
  await onboard(page)

  await page.getByTestId('meal-section-breakfast').getByRole('link', { name: '+ Add food' }).click()
  await expect(page).toHaveURL(/\/log\/add\?meal=breakfast/)

  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByLabel('Quantity').fill('3')
  await expect(page.getByTestId('entry-preview')).toContainText('123 kcal')
  await page.getByRole('button', { name: 'Add to Breakfast' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('kcal-remaining')).toHaveText('1505') // 1628 - 123
  await expect(page.getByTestId('protein-bar-value')).toHaveText('5 / 126 g')

  await page.getByTestId('meal-section-breakfast').getByRole('link', { name: '+ Add food' }).click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('sambhar')
  await page.getByTestId('search-results').getByRole('button', { name: 'Sambar', exact: true }).click()
  await expect(page.getByTestId('entry-preview')).toContainText('93 kcal')
  await page.getByRole('button', { name: 'Add to Breakfast' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('kcal-remaining')).toHaveText('1412') // 1628 - 216
  await expect(page.getByTestId('protein-bar-value')).toHaveText('10 / 126 g')
  await expect(page.getByTestId('carbs-bar-value')).toHaveText('36 / 171 g')
  await expect(page.getByTestId('fat-bar-value')).toHaveText('4 / 49 g')
  await expect(page.getByTestId('meal-subtotal-breakfast')).toHaveText('216 kcal')

  await page.reload()
  await expect(page.getByTestId('kcal-remaining')).toHaveText('1412')
  await expect(page.getByTestId('meal-subtotal-breakfast')).toHaveText('216 kcal')
})

test('offline logging: once seeded, adding a food entry works entirely without network', async ({
  page,
  context,
}) => {
  await onboard(page)

  await context.setOffline(true)

  await page.getByTestId('meal-section-lunch').getByRole('link', { name: '+ Add food' }).click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('chicken curry')
  await page.getByTestId('search-results').getByRole('button', { name: 'Chicken Curry', exact: true }).click()
  await page.getByRole('button', { name: 'Add to Lunch' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('meal-subtotal-lunch')).not.toHaveText('0 kcal')

  await context.setOffline(false)
})

test('editing quantity and deleting an entry update the day totals', async ({ page }) => {
  await onboard(page)

  await page.getByTestId('meal-section-dinner').getByRole('link', { name: '+ Add food' }).click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByRole('button', { name: 'Add to Dinner' }).click()

  await expect(page.getByTestId('meal-subtotal-dinner')).toHaveText('41 kcal') // 1 idli (40g), 102.5*0.4=41

  await page.getByTestId('meal-section-dinner').getByRole('link', { name: 'Edit' }).click()
  await page.getByLabel('Quantity').fill('2')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByTestId('meal-subtotal-dinner')).toHaveText('82 kcal') // 2 idli (80g), 102.5*0.8=82

  await page.getByTestId('meal-section-dinner').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByTestId('meal-subtotal-dinner')).toHaveText('0 kcal')
})
