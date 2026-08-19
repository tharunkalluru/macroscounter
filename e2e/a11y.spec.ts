import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'

async function onboard(page: Page) {
  // Dead-zone hour (00:00-4:59) so the Phase 10.3 meal prompt never fires and
  // blocks this test's own interactions -- these tests don't care what time
  // it is, they just need it to not be a live meal window.
  await page.clock.setFixedTime(new Date('2026-08-18T02:00:00'))
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()
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
