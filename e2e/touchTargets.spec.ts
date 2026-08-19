import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'

const MIN_SIZE = 44

async function onboard(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('Your name').fill('Touch Target Persona')
  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByPlaceholder('years').fill('28')
  await page.getByPlaceholder('cm').fill('170')
  await page.getByPlaceholder('kg').fill('70')
  await page.getByLabel('Activity level').selectOption('sedentary')
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL('/')
}

/**
 * Asserts every visible interactive element on the current page has a
 * bounding box of at least 44x44px. Native radio/checkbox inputs are
 * measured via their enclosing <label> (the real tap target for a
 * small form control), everything else is measured directly.
 */
async function auditTouchTargets(page: Page, pageName: string) {
  const violations = await page.evaluate((min) => {
    function isVisible(el: Element): boolean {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return false
      const style = window.getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') return false
      if ((el as HTMLButtonElement).disabled) return false
      return true
    }

    const selector = 'button, a[href], select, input:not([type="radio"]):not([type="checkbox"]), textarea'
    const results: { selector: string; text: string; width: number; height: number }[] = []

    document.querySelectorAll(selector).forEach((el) => {
      if (!isVisible(el)) return
      const rect = el.getBoundingClientRect()
      if (rect.width < min || rect.height < min) {
        results.push({
          selector: el.tagName.toLowerCase() + (el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : ''),
          text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        })
      }
    })

    document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach((el) => {
      if (!isVisible(el)) return
      const label = el.closest('label')
      const target = label ?? el
      const rect = target.getBoundingClientRect()
      if (rect.width < min || rect.height < min) {
        results.push({
          selector: 'label(radio/checkbox)',
          text: (target.textContent || '').trim().slice(0, 40),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        })
      }
    })

    return results
  }, MIN_SIZE)

  expect(violations, `Touch-target violations on ${pageName}: ${JSON.stringify(violations, null, 2)}`).toEqual([])
}

test.describe('touch-target audit (390x844, every visible interactive element >= 44x44)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('onboarding form', async ({ page }) => {
    await page.goto('/')
    await auditTouchTargets(page, 'onboarding')
  })

  test('today dashboard', async ({ page }) => {
    await onboard(page)
    await auditTouchTargets(page, 'today dashboard')
  })

  test('add-food sheet', async ({ page }) => {
    await onboard(page)
    await page.getByTestId('fab-scan').click()
    await expect(page.getByTestId('bottom-sheet')).toBeVisible()
    await auditTouchTargets(page, 'add-food sheet')
  })

  test('history/calendar page', async ({ page }) => {
    await onboard(page)
    await page.goto('/history')
    await auditTouchTargets(page, 'history')
  })

  test('trends page', async ({ page }) => {
    await onboard(page)
    await page.goto('/trends')
    await auditTouchTargets(page, 'trends')
  })

  test('settings page', async ({ page }) => {
    await onboard(page)
    await page.goto('/settings')
    await auditTouchTargets(page, 'settings')
  })

  test('templates page', async ({ page }) => {
    await onboard(page)
    await page.goto('/templates')
    await auditTouchTargets(page, 'templates')
  })

  test('scan page', async ({ page }) => {
    await onboard(page)
    await page.goto('/scan')
    await auditTouchTargets(page, 'scan')
  })
})
