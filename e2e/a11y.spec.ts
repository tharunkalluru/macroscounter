import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'A11y Persona' })
}

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
}

test('sign-in (welcome) screen has no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/welcome$/)
  await expectNoViolations(page)
})

test('onboarding form has no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()
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

test('trends page has no WCAG A/AA violations', async ({ page }) => {
  await onboard(page)
  await page.goto('/trends')
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
