import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'

async function onboard(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('Your name').fill('A11y Persona')
  await page.getByPlaceholder('years').fill('28')
  await page.getByPlaceholder('cm').fill('170')
  await page.getByPlaceholder('kg').fill('70')
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL('/')
}

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
}

test('onboarding form has no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/')
  await expectNoViolations(page)
})

test('dashboard has no WCAG A/AA violations', async ({ page }) => {
  await onboard(page)
  await expectNoViolations(page)
})

test('add-food page has no WCAG A/AA violations', async ({ page }) => {
  await onboard(page)
  await page.goto('/log/add?meal=breakfast')
  await expectNoViolations(page)
})

test('history/calendar page has no WCAG A/AA violations', async ({ page }) => {
  await onboard(page)
  await page.goto('/history')
  await expectNoViolations(page)
})

test('weight page has no WCAG A/AA violations', async ({ page }) => {
  await onboard(page)
  await page.goto('/weight')
  await expectNoViolations(page)
})

test('templates page has no WCAG A/AA violations', async ({ page }) => {
  await onboard(page)
  await page.goto('/templates')
  await expectNoViolations(page)
})

test('report page has no WCAG A/AA violations', async ({ page }) => {
  await onboard(page)
  await page.goto('/report')
  await expectNoViolations(page)
})

test('settings page has no WCAG A/AA violations', async ({ page }) => {
  await onboard(page)
  await page.goto('/settings')
  await expectNoViolations(page)
})

test('scan page has no WCAG A/AA violations', async ({ page }) => {
  await onboard(page)
  await page.goto('/scan')
  await expectNoViolations(page)
})
