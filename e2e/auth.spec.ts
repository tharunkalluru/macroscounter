import { expect, test } from '@playwright/test'

test('first launch shows the sign-in screen with a Google option and a guest skip', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByRole('heading', { name: 'MacroDesi' })).toBeVisible()
  await expect(page.getByTestId('signin-google-button')).toBeVisible()
  await expect(page.getByTestId('signin-skip-button')).toBeVisible()
})

test('guest mode is fully functional with the auth API entirely blocked', async ({ page }) => {
  await page.route('**/api/auth/**', (route) => route.abort())

  await page.goto('/')
  await expect(page).toHaveURL(/\/welcome$/)
  await page.getByTestId('signin-skip-button').click()
  await expect(page).toHaveURL(/\/onboarding$/)

  await page.getByPlaceholder('Your name').fill('Blocked Auth Persona')
  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByPlaceholder('years').fill('28')
  await page.getByPlaceholder('cm').fill('170')
  await page.getByPlaceholder('kg').fill('70')
  await page.getByLabel('Activity level').selectOption('sedentary')
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL('/')

  await page.getByTestId('add-breakfast').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByRole('button', { name: 'Add to Breakfast' }).click()
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('meal-subtotal-breakfast')).toContainText('kcal')

  await page.getByTestId('tab-settings').click()
  await expect(page.getByTestId('account-sign-in-button')).toBeVisible()
  await expect(page.getByTestId('sync-status')).toContainText('Not signed in')
})

test('reload after skipping does not show the sign-in screen again', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()
  await page.getByPlaceholder('Your name').fill('Repeat Visit Persona')
  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByPlaceholder('years').fill('28')
  await page.getByPlaceholder('cm').fill('170')
  await page.getByPlaceholder('kg').fill('70')
  await page.getByLabel('Activity level').selectOption('sedentary')
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL('/')

  await page.reload()
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('today-view')).toBeVisible()
})
