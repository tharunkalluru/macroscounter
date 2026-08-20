import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Dark Mode Persona' })
}

test('dark-mode toggle persists across reload', async ({ page }) => {
  await onboard(page)

  await expect(page.locator('html')).not.toHaveClass(/dark/)

  await page.getByTestId('avatar-link').click()
  await expect(page).toHaveURL('/settings')

  await page.getByTestId('theme-option-dark').click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByTestId('theme-option-dark')).toHaveAttribute('aria-checked', 'true')

  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.goto('/settings')
  await page.getByTestId('theme-option-light').click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})

test('sign-in (welcome) screen has no WCAG A/AA violations in dark mode', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('macrodesi-theme', 'dark'))
  await page.goto('/')
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.locator('html')).toHaveClass(/dark/)

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})

test('dashboard has no WCAG A/AA violations in dark mode', async ({ page }) => {
  await onboard(page)
  await page.getByTestId('avatar-link').click()
  await page.getByTestId('theme-option-dark').click()
  await page.goto('/')

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})

test('settings page has no WCAG A/AA violations in dark mode', async ({ page }) => {
  await onboard(page)
  await page.getByTestId('avatar-link').click()
  await page.getByTestId('theme-option-dark').click()

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})

test('add-food sheet has no WCAG A/AA violations in dark mode', async ({ page }) => {
  await onboard(page)
  await page.getByTestId('avatar-link').click()
  await page.getByTestId('theme-option-dark').click()
  await page.goto('/')

  await page.getByTestId('fab-scan').click()
  await expect(page.getByTestId('bottom-sheet')).toBeVisible()

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})
