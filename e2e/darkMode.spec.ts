import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Dark Mode Persona' })
}

// Theme picker lives on the Appearance & export sub-page (Settings hub
// restructure) -- call this once already on /settings (via avatar-link or
// goto) before touching any theme-option-* control.
async function goToAppearance(page: Page) {
  await page.getByTestId('settings-row-appearance').click()
  await expect(page).toHaveURL('/settings/appearance')
}

async function setTheme(page: Page, option: 'light' | 'dark' | 'contrast') {
  await goToAppearance(page)
  await page.getByTestId(`theme-option-${option}`).click()
}

test('dark is the default appearance, and an explicit choice persists across reload', async ({ page }) => {
  await onboard(page)

  // Phase F.1: dark is the design's only real theme -- anyone who hasn't
  // touched the appearance toggle lands here by default.
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('html')).not.toHaveClass(/contrast/)

  await page.getByTestId('avatar-link').click()
  await expect(page).toHaveURL('/settings')
  await goToAppearance(page)
  await expect(page.getByTestId('theme-option-dark')).toHaveAttribute('aria-checked', 'true')

  await page.getByTestId('theme-option-contrast').click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveClass(/contrast/)

  await page.reload()
  await expect(page.locator('html')).toHaveClass(/contrast/)
  await expect(page.getByTestId('theme-option-contrast')).toHaveAttribute('aria-checked', 'true')

  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/contrast/)

  await page.goto('/settings')
  await goToAppearance(page)
  await page.getByTestId('theme-option-light').click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await expect(page.locator('html')).not.toHaveClass(/contrast/)
  await page.reload()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})

test('a stored legacy "system" preference migrates once to a concrete choice', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('macrodesi-theme', 'system'))
  await onboard(page)

  // jsdom/Playwright's default color-scheme is light, so a legacy 'system'
  // value resolves to 'light' the first time the app reads it, and gets
  // rewritten in place -- it never reappears as 'system' again.
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  expect(await page.evaluate(() => localStorage.getItem('macrodesi-theme'))).toBe('light')

  await page.getByTestId('avatar-link').click()
  await goToAppearance(page)
  await expect(page.getByTestId('theme-option-light')).toHaveAttribute('aria-checked', 'true')
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
  await setTheme(page, 'dark')
  await page.goto('/')

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})

test('settings page has no WCAG A/AA violations in dark mode', async ({ page }) => {
  await onboard(page)
  await page.getByTestId('avatar-link').click()
  await setTheme(page, 'dark')
  await page.goto('/settings')

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})

test('settings food & sources sub-page has no WCAG A/AA violations in dark mode', async ({ page }) => {
  await onboard(page)
  await page.getByTestId('avatar-link').click()
  await setTheme(page, 'dark')
  await page.goto('/settings/food')

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})

test('settings appearance & export sub-page has no WCAG A/AA violations in dark mode', async ({ page }) => {
  await onboard(page)
  await page.getByTestId('avatar-link').click()
  await setTheme(page, 'dark')
  await page.goto('/settings/appearance')

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})

test('add-food sheet has no WCAG A/AA violations in dark mode', async ({ page }) => {
  await onboard(page)
  await page.getByTestId('avatar-link').click()
  await setTheme(page, 'dark')
  await page.goto('/')

  await page.getByTestId('fab-scan').click()
  await expect(page.getByTestId('bottom-sheet')).toBeVisible()

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})

test('log tab has no WCAG A/AA violations in dark mode', async ({ page }) => {
  await onboard(page)
  await page.getByTestId('avatar-link').click()
  await setTheme(page, 'dark')
  await page.goto('/log')

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})

test('trends hub has no WCAG A/AA violations in dark mode', async ({ page }) => {
  await onboard(page)
  await page.getByTestId('avatar-link').click()
  await setTheme(page, 'dark')
  await page.goto('/trends')

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})

test('coach strategy hub has no WCAG A/AA violations in dark mode', async ({ page }) => {
  await onboard(page)
  await page.getByTestId('avatar-link').click()
  await setTheme(page, 'dark')
  await page.goto('/coach')

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
})
