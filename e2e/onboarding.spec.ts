import { expect, test } from '@playwright/test'

// Same fixture persona as the "male, sedentary, cut: BMR floor binds" case in
// src/domain/goals/goalEngine.test.ts — kcal 1628 / protein 126 / carbs 171 / fat 49.
test('completing onboarding computes and shows the correct kcal target on the dashboard', async ({
  page,
}) => {
  // Dead-zone hour (00:00-4:59) so the Phase 10.3 meal prompt never fires and
  // blocks this test's own dashboard interactions.
  await page.clock.setFixedTime(new Date('2026-08-18T02:00:00'))
  await page.goto('/')
  await expect(page).toHaveURL(/\/welcome$/)
  await page.getByTestId('signin-skip-button').click()
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByRole('heading', { name: /macrodesi/i })).toBeVisible()

  await page.getByPlaceholder('Your name').fill('Fixture Persona')
  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByPlaceholder('years').fill('28')
  await page.getByPlaceholder('cm').fill('170')
  await page.getByPlaceholder('kg').fill('70')
  await page.getByLabel('Activity level').selectOption('sedentary')
  await page.getByRole('radio', { name: 'Lose fat', exact: true }).check()

  await page.getByRole('button', { name: 'Get started' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('kcal-target')).toHaveText('1628 kcal target')
  await expect(page.getByTestId('protein-bar-value')).toHaveText('0 / 126 g')
  await expect(page.getByTestId('carbs-bar-value')).toHaveText('0 / 171 g')
  await expect(page.getByTestId('fat-bar-value')).toHaveText('0 / 49 g')
})

test('data persists across a reload after onboarding', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-18T02:00:00'))
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()
  await page.getByPlaceholder('Your name').fill('Reload Check')
  await page.getByRole('radio', { name: 'female', exact: true }).check()
  await page.getByPlaceholder('years').fill('26')
  await page.getByPlaceholder('cm').fill('165')
  await page.getByPlaceholder('kg').fill('60')
  await page.getByLabel('Activity level').selectOption('very_active')
  await page.getByRole('button', { name: 'Get started' }).click()

  await expect(page.getByTestId('kcal-target')).toHaveText('2046 kcal target')

  await page.reload()

  await expect(page.getByTestId('kcal-target')).toHaveText('2046 kcal target')
  // Header avatar shows the profile's initial (no more "Hi {name}" text link post-9B).
  await expect(page.getByTestId('avatar-link')).toHaveText('R')
})
