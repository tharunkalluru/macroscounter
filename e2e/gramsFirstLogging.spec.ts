import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date('2026-08-18T02:00:00'))
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()
  await page.getByPlaceholder('Your name').fill('Grams First Persona')
  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByPlaceholder('years').fill('28')
  await page.getByPlaceholder('cm').fill('170')
  await page.getByPlaceholder('kg').fill('70')
  await page.getByLabel('Activity level').selectOption('sedentary')
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL('/')
}

test('selecting a food pre-fills grams from its typical portion, auto-focused with a numeric keypad', async ({
  page,
}) => {
  await onboard(page)

  await page.getByTestId('add-breakfast').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()

  const gramsInput = page.getByTestId('portion-grams-input')
  await expect(gramsInput).toHaveValue('40') // idli's typical portion: 1 idli = 40g
  await expect(gramsInput).toBeFocused()
  await expect(gramsInput).toHaveAttribute('inputmode', 'decimal')
  await expect(page.getByTestId('entry-preview')).toContainText('41 kcal')
})

test('search-to-logged in 2 taps + typing grams (select, then log) — no household-unit step required', async ({
  page,
}) => {
  await onboard(page)

  // Tap 1: select the food.
  await page.getByTestId('add-lunch').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('chicken curry')
  await page.getByTestId('search-results').getByRole('button', { name: 'Chicken Curry', exact: true }).click()

  // Typing (not a tap): the pre-focused field is selected on focus, so
  // typing directly replaces the default without an extra clear/tap.
  await page.getByTestId('portion-grams-input').fill('200')
  await expect(page.getByTestId('entry-preview')).toContainText('322 kcal') // 200g of 161 kcal/100g

  // Tap 2: log it.
  await page.getByTestId('log-entry-button').click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('meal-subtotal-lunch')).toHaveText('322 kcal')
})

test('a household-unit reference chip fills the field as grams, and the log button previews the live result', async ({
  page,
}) => {
  await onboard(page)

  await page.getByTestId('add-dinner').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()

  const portionChip = page.getByTestId('gram-chip-portion').first()
  await expect(portionChip).toContainText('1 idli ≈ 40 g')

  // Tap: a fixed quick-adjust chip. 100g of idli's 102.5 kcal/100g -> 102.5,
  // displayed rounded to a whole number (103) like every kcal figure in the app.
  await page.getByTestId('gram-chip-100').click()
  await expect(page.getByTestId('portion-grams-input')).toHaveValue('100')
  await expect(page.getByTestId('entry-preview')).toContainText('103 kcal · 4.5p / 20c / 0.5f')
  await expect(page.getByTestId('log-entry-button')).toHaveText('Add 100 g · 103 kcal')

  // Tap: log it — 3rd tap total (select, chip, log).
  await page.getByTestId('log-entry-button').click()
  await expect(page.getByTestId('meal-subtotal-dinner')).toHaveText('103 kcal')

  // The logged row itself shows grams, not a household-unit label — Phase
  // 10.4's "household units become gram shortcuts, never the stored unit."
  await expect(page.getByRole('button', { name: 'Edit Idli' })).toContainText('100 g')
})
