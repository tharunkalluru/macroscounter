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

// Fixture persona: kcal target 1628 (see goalEngine.test.ts).
test('over-budget: logging past the target turns the ring amber and shows "+n over"', async ({ page }) => {
  await onboard(page)

  await page.getByTestId('meal-section-lunch').getByRole('link', { name: '+ Custom' }).click()
  await expect(page).toHaveURL(/\/log\/quick-add\?meal=lunch/)
  await page.getByLabel('Name').fill('Feast')
  await page.getByLabel('Calories (kcal)').fill('2000')
  await page.getByRole('button', { name: 'Add to Lunch' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('kcal-remaining')).toHaveText('+372') // 2000 - 1628
  await expect(page.getByTestId('calories-ring')).toHaveAccessibleName(/372 over/)

  const ringFillCircle = page.getByTestId('calories-ring').locator('circle').nth(1)
  await expect(ringFillCircle).toHaveAttribute('stroke', '#d97706') // semantic.warn[600]
})

test('under target: the ring stays brand-colored and shows plain remaining kcal', async ({ page }) => {
  await onboard(page)

  await page.getByTestId('meal-section-lunch').getByRole('link', { name: '+ Custom' }).click()
  await page.getByLabel('Name').fill('Snack')
  await page.getByLabel('Calories (kcal)').fill('200')
  await page.getByRole('button', { name: 'Add to Lunch' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('kcal-remaining')).toHaveText('1428') // 1628 - 200
  await expect(page.getByTestId('calories-ring')).toHaveAccessibleName('200 of 1628 calories remaining')

  const ringFillCircle = page.getByTestId('calories-ring').locator('circle').nth(1)
  await expect(ringFillCircle).toHaveAttribute('stroke', '#0F9D58') // semantic.success[600]
})

test('tapping a macro bar opens the per-meal breakdown sheet with correct totals', async ({ page }) => {
  await onboard(page)

  await page.getByTestId('meal-section-breakfast').getByRole('link', { name: '+ Add food' }).click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByRole('button', { name: 'Add to Breakfast' }).click()
  await expect(page).toHaveURL('/')

  await page.getByTestId('protein-bar').click()
  await expect(page.getByRole('heading', { name: 'Protein by meal' })).toBeVisible()

  const list = page.getByTestId('macro-breakdown-list')
  const breakfastRow = list.getByRole('listitem').filter({ hasText: 'Breakfast' })
  await expect(breakfastRow).toContainText('1.8 g')
  const lunchRow = list.getByRole('listitem').filter({ hasText: 'Lunch' })
  await expect(lunchRow).toContainText('0 g')

  await expect(page.getByTestId('macro-breakdown-total')).toHaveText('1.8 g')

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('bottom-sheet')).not.toBeVisible()
})
