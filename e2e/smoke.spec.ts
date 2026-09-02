import { expect, test } from '@playwright/test'

test('home page loads and renders the app shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /bitewise/i })).toBeVisible()
})

test('web app manifest is present and valid', async ({ page, request }) => {
  await page.goto('/')
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifestHref).toBeTruthy()

  const manifestUrl = new URL(manifestHref!, page.url()).toString()
  const res = await request.get(manifestUrl)
  expect(res.ok()).toBeTruthy()

  const manifest = await res.json()
  expect(manifest.name).toBe('Bitewise')
  expect(manifest.icons?.length).toBeGreaterThan(0)

  // Phase 10.6: installed/standalone-app feel.
  expect(manifest.display).toBe('standalone')
  expect(manifest.display_override).toEqual(['window-controls-overlay', 'standalone'])
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
  expect(manifest.icons.some((i: { sizes?: string }) => i.sizes === '512x512')).toBe(true)
})

test('service worker registers on the preview build', async ({ page }) => {
  await page.goto('/')
  const hasController = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false
    const reg = await navigator.serviceWorker.ready
    return !!reg.active
  })
  expect(hasController).toBe(true)
})
