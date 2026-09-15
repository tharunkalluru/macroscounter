import { expect, test } from '@playwright/test'
import { onboard } from './helpers/onboard'

test('a first-time visit to "/" shows the landing page with feature content and a working CTA', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/landing$/)

  await expect(page.getByRole('heading', { name: /bitewise/i, level: 1 })).toBeVisible()
  await expect(page.getByText('AI-powered logging')).toBeVisible()
  await expect(page.getByText('Barcode scanning')).toBeVisible()

  await page.getByTestId('landing-cta-primary').click()
  await expect(page).toHaveURL(/\/welcome$/)
})

test('the nav "Sign in" link and the final CTA both reach the sign-in screen', async ({ page }) => {
  await page.goto('/landing')
  await page.getByTestId('landing-nav-signin').click()
  await expect(page).toHaveURL(/\/welcome$/)

  await page.goBack()
  await expect(page).toHaveURL(/\/landing$/)
  await page.getByTestId('landing-cta-final').click()
  await expect(page).toHaveURL(/\/welcome$/)
})

test('the "see what it can do" link scrolls to the features section without navigating away', async ({ page }) => {
  await page.goto('/landing')
  await page.getByTestId('landing-cta-secondary').click()
  await expect(page).toHaveURL(/\/landing#features$/)
  await expect(page.getByRole('heading', { name: "Everything you need, nothing you don't" })).toBeInViewport()
})

test('a device that has already made a sign-in choice never sees the landing page again', async ({ page }) => {
  await onboard(page, { name: 'Returning Visitor' })

  await page.goto('/')
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('today-view')).toBeVisible()
})
