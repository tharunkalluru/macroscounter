import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'

async function onboard(page: Page) {
  await page.clock.setFixedTime(new Date('2026-08-18T02:00:00'))
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()
  await page.getByPlaceholder('Your name').fill('Native Feel Persona')
  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByPlaceholder('years').fill('28')
  await page.getByPlaceholder('cm').fill('170')
  await page.getByPlaceholder('kg').fill('70')
  await page.getByLabel('Activity level').selectOption('sedentary')
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL('/')
}

test('apple/iOS meta tags and icons are present for the installed-app look', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png')
  expect(await page.locator('link[rel="apple-touch-startup-image"]').count()).toBeGreaterThan(0)
})

test('repeat visits load Today in under 1.5s (precached shell)', async ({ page }) => {
  await onboard(page)

  // Let the service worker finish installing/precaching before measuring —
  // the budget is for a *repeat* visit, not the very first cold load.
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready
  })

  const start = Date.now()
  await page.reload()
  await page.getByTestId('today-view').waitFor({ state: 'visible' })
  const elapsedMs = Date.now() - start

  expect(elapsedMs, `repeat-visit load took ${elapsedMs}ms`).toBeLessThan(1500)
})

test('no horizontal overscroll on the dashboard, history, or settings', async ({ page }) => {
  await onboard(page)

  for (const path of ['/', '/history', '/settings']) {
    await page.goto(path)
    const overflowsX = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(overflowsX, `${path} has horizontal overflow`).toBe(false)
  }
})

test('install coach-mark: Android/Chrome gets the native beforeinstallprompt trigger', async ({ page }) => {
  await onboard(page)

  await page.evaluate(() => {
    const event = Object.assign(new Event('beforeinstallprompt'), {
      preventDefault: () => {},
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    })
    window.dispatchEvent(event)
  })

  await expect(page.getByTestId('install-coach-mark')).toBeVisible()
  await expect(page.getByTestId('install-coach-mark-install')).toBeVisible()
})

test('install coach-mark: iOS Safari gets Share -> Add to Home Screen instructions, no native trigger', async ({
  browser,
}) => {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const page = await context.newPage()
  await onboard(page)

  await expect(page.getByTestId('install-coach-mark')).toBeVisible()
  await expect(page.getByTestId('install-coach-mark-install')).not.toBeVisible()
  await expect(page.getByText(/Add to Home Screen/)).toBeVisible()

  await context.close()
})

test('install coach-mark never shows once the app is already running standalone', async ({ page }) => {
  await page.addInitScript(() => {
    window.matchMedia = ((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    })) as unknown as typeof window.matchMedia
  })

  await onboard(page)
  await page.evaluate(() => {
    window.dispatchEvent(
      Object.assign(new Event('beforeinstallprompt'), {
        preventDefault: () => {},
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      })
    )
  })

  await expect(page.getByTestId('install-coach-mark')).not.toBeVisible()
})
