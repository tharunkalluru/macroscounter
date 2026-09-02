import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

const MIN_SIZE = 44

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Touch Target Persona' })
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

  test('sign-in (welcome) screen', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/welcome$/)
    await auditTouchTargets(page, 'welcome')
  })

  test('onboarding form', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('signin-skip-button').click()
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

  test('log tab (Meals view)', async ({ page }) => {
    await onboard(page)
    await page.goto('/log')
    await auditTouchTargets(page, 'log meals')
  })

  test('log tab (Month view)', async ({ page }) => {
    await onboard(page)
    await page.goto('/log')
    await page.getByTestId('log-tab-month').click()
    await expect(page.getByTestId('calendar-grid')).toBeVisible()
    await auditTouchTargets(page, 'log month')
  })

  test('log tab (Timeline view)', async ({ page }) => {
    await onboard(page)
    await page.goto('/log')
    await page.getByTestId('log-tab-timeline').click()
    await expect(page.getByTestId('timeline-view')).toBeVisible()
    await auditTouchTargets(page, 'log timeline')
  })

  test('your usuals page', async ({ page }) => {
    await onboard(page)
    await page.goto('/log/usuals')
    await auditTouchTargets(page, 'your usuals')
  })

  test('weigh-in entry page', async ({ page }) => {
    await onboard(page)
    await page.goto('/weight/entry')
    await auditTouchTargets(page, 'weigh-in entry')
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

  test('trends expenditure page', async ({ page }) => {
    await onboard(page)
    await page.goto('/trends/expenditure')
    await auditTouchTargets(page, 'trends expenditure')
  })

  test('trends habits page', async ({ page }) => {
    await onboard(page)
    await page.goto('/trends/habits')
    await auditTouchTargets(page, 'trends habits')
  })

  test('trends weekly report page', async ({ page }) => {
    await onboard(page)
    await page.goto('/trends/report')
    await auditTouchTargets(page, 'trends weekly report')
  })

  test('settings page', async ({ page }) => {
    await onboard(page)
    await page.goto('/settings')
    await auditTouchTargets(page, 'settings')
  })

  test('settings food & sources sub-page', async ({ page }) => {
    await onboard(page)
    await page.goto('/settings/food')
    await auditTouchTargets(page, 'settings-food')
  })

  test('settings appearance & export sub-page', async ({ page }) => {
    await onboard(page)
    await page.goto('/settings/appearance')
    await auditTouchTargets(page, 'settings-appearance')
  })

  test('templates page', async ({ page }) => {
    await onboard(page)
    await page.goto('/templates')
    await auditTouchTargets(page, 'templates')
  })

  test('coach page', async ({ page }) => {
    await onboard(page)
    await page.goto('/coach')
    await auditTouchTargets(page, 'coach')
  })

  test('coach weekly check-in wizard', async ({ page }) => {
    await onboard(page)
    await page.goto('/coach/check-in')
    await auditTouchTargets(page, 'coach check-in')
  })

  test('scan page', async ({ page }) => {
    await onboard(page)
    await page.goto('/scan')
    await auditTouchTargets(page, 'scan')
  })
})
