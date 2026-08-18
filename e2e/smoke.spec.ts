import { expect, test } from '@playwright/test'

test('home page loads and renders the app shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /macrodesi/i })).toBeVisible()
})

test('web app manifest is present and valid', async ({ page, request }) => {
  await page.goto('/')
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifestHref).toBeTruthy()

  const manifestUrl = new URL(manifestHref!, page.url()).toString()
  const res = await request.get(manifestUrl)
  expect(res.ok()).toBeTruthy()

  const manifest = await res.json()
  expect(manifest.name).toBe('MacroDesi')
  expect(manifest.icons?.length).toBeGreaterThan(0)
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
