import { readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'

async function onboard(page: Page) {
  // Dead-zone hour (00:00-4:59) so the Phase 10.3 meal prompt never fires and
  // blocks this test's own interactions -- these tests don't care what time
  // it is, they just need it to not be a live meal window.
  await page.clock.setFixedTime(new Date('2026-08-18T02:00:00'))
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()
  await page.getByPlaceholder('Your name').fill('Template Persona')
  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByPlaceholder('years').fill('28')
  await page.getByPlaceholder('cm').fill('170')
  await page.getByPlaceholder('kg').fill('70')
  await page.getByLabel('Activity level').selectOption('sedentary')
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL('/')
}

test('save a meal as a template, then one-tap log it the next day with correct totals', async ({ page }) => {
  await onboard(page) // pins the clock to 2026-08-18T02:00 (see onboard())

  // Log 3 idli for breakfast (120g -> 123 kcal, matches the applyTemplate fixture).
  await page.getByTestId('add-breakfast').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByLabel('Quantity').fill('3')
  await page.getByRole('button', { name: 'Add to Breakfast' }).click()
  await expect(page.getByTestId('meal-subtotal-breakfast')).toHaveText('123 kcal')

  await page.getByTestId('meal-overflow-breakfast').click()
  await page.getByTestId('overflow-save-template').click()
  await expect(page).toHaveURL(/\/templates\/new/)
  await page.getByPlaceholder('e.g. Usual Breakfast').fill('My Breakfast')
  await page.getByRole('button', { name: 'Save template' }).click()
  await expect(page).toHaveURL('/templates')
  await expect(page.getByTestId('templates-list')).toContainText('My Breakfast')

  // Advance to the next day — a fresh, empty log.
  await page.clock.setFixedTime(new Date('2026-08-19T02:00:00'))
  await page.goto('/')
  await expect(page.getByTestId('meal-subtotal-breakfast')).toHaveText('0 kcal')

  // One-tap log the template (defaults to Breakfast).
  await page.goto('/templates')
  await page.getByRole('button', { name: 'Log now' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('meal-subtotal-breakfast')).toHaveText('123 kcal')
})

test('CSV export downloads parseable files with the correct row counts', async ({ page }) => {
  await onboard(page)

  await page.getByTestId('add-breakfast').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByRole('button', { name: 'Add to Breakfast' }).click()
  await expect(page.getByTestId('bottom-sheet')).not.toBeVisible() // wait for the save to actually land before hard-navigating

  await page.getByTestId('add-lunch').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('sambhar')
  await page.getByTestId('search-results').getByRole('button', { name: 'Sambar', exact: true }).click()
  await page.getByRole('button', { name: 'Add to Lunch' }).click()
  await expect(page.getByTestId('bottom-sheet')).not.toBeVisible()

  await page.goto('/weight')
  await page.getByLabel('Weight (kg)').fill('79.5')
  await page.getByRole('button', { name: 'Log' }).click()
  await expect(page.getByTestId('weighin-list')).toContainText('79.5 kg')

  await page.goto('/export')

  const [logsDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export food logs (CSV)' }).click(),
  ])
  expect(logsDownload.suggestedFilename()).toBe('macrodesi-logs.csv')
  const logsPath = await logsDownload.path()
  const logsCsv = readFileSync(logsPath!, 'utf-8')
  const logsLines = logsCsv.trim().split('\r\n')
  expect(logsLines).toHaveLength(3) // header + 2 logged entries
  expect(logsLines[0]).toBe('date,meal,name,portionSummary,qty,unit,grams,kcal,p,c,f')

  const [weighInsDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export weigh-ins (CSV)' }).click(),
  ])
  expect(weighInsDownload.suggestedFilename()).toBe('macrodesi-weighins.csv')
  const weighInsPath = await weighInsDownload.path()
  const weighInsCsv = readFileSync(weighInsPath!, 'utf-8')
  const weighInsLines = weighInsCsv.trim().split('\r\n')
  expect(weighInsLines).toHaveLength(2) // header + 1 weigh-in
  expect(weighInsLines[0]).toBe('date,weightKg')
})
