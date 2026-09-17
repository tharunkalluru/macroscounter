import { expect, test, type Page } from '@playwright/test'
import { onboard } from './helpers/onboard'

async function openAppearance(page: Page) {
  await page.getByTestId('avatar-link').click()
  await page.getByTestId('settings-row-appearance').click()
  await expect(page).toHaveURL('/settings/appearance')
}

async function expectSelectedDayVisible(page: Page) {
  const selectedDay = page.getByTestId('weekly-diary-card').locator('button[aria-current="date"]')
  await expect(selectedDay).toHaveCount(1)
  await expect.poll(() => selectedDay.evaluate((button) => {
    let parent = button.parentElement
    while (parent && !['auto', 'scroll'].includes(getComputedStyle(parent).overflowX)) {
      parent = parent.parentElement
    }
    if (!parent) return false
    const viewport = parent.getBoundingClientRect()
    const selected = button.getBoundingClientRect()
    return selected.left >= viewport.left - 1 && selected.right <= viewport.right + 1
  })).toBe(true)
}

test('320px diary keeps larger nutrition values and selected history day usable', async ({ page }) => {
  test.setTimeout(45000)
  await page.setViewportSize({ width: 320, height: 740 })
  await onboard(page, { name: 'Small Screen Reviewer' })
  await openAppearance(page)
  await page.getByRole('switch', { name: 'Larger numbers', exact: true }).click()
  await expect(page.getByRole('switch', { name: 'Larger numbers', exact: true })).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('tab-today').click()
  await expect(page.getByTestId('targets-card')).toBeVisible()

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const nutritionOverflow = await page.getByTestId('targets-card').evaluate((card) => {
    const bounds = card.getBoundingClientRect()
    const style = getComputedStyle(card)
    const left = bounds.left + Number.parseFloat(style.paddingLeft)
    const right = bounds.right - Number.parseFloat(style.paddingRight)
    return Array.from(card.querySelectorAll('p, span, svg')).flatMap((element) => {
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0 || (rect.left >= left - 1 && rect.right <= right + 1)) return []
      return [{ text: element.textContent?.trim(), left: rect.left, right: rect.right }]
    })
  })
  expect(nutritionOverflow, 'Nutrition remains inside the padded card at 320px').toEqual([])

  const week = page.getByTestId('weekly-diary-card')
  await week.scrollIntoViewIfNeeded()
  await expectSelectedDayVisible(page)
  const dayTargets = await week.getByRole('button').evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }))
  expect(dayTargets).toHaveLength(7)
  for (const target of dayTargets) {
    expect(target.width).toBeGreaterThanOrEqual(44)
    expect(target.height).toBeGreaterThanOrEqual(44)
  }

  // The visible history strip and date picker both keep the requested day.
  await week.getByRole('button', { name: 'August 17: no entries', exact: true }).click()
  await expect(page.getByLabel('Choose diary date')).toHaveValue('2026-08-17')
  await expectSelectedDayVisible(page)
  await page.getByLabel('Choose diary date').fill('2026-08-12')
  await expect(page.getByLabel('Choose diary date')).toHaveValue('2026-08-12')
  await page.getByRole('button', { name: 'Previous day', exact: true }).click()
  await expect(page.getByLabel('Choose diary date')).toHaveValue('2026-08-11')
  await expectSelectedDayVisible(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('reduced motion and keyboard logging preserve focus through reopen and navigation', async ({ page }) => {
  test.setTimeout(45000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await onboard(page, { name: 'Keyboard Reviewer' })
  await openAppearance(page)
  await page.getByRole('switch', { name: 'Reduce motion', exact: true }).click()
  await expect(page.getByRole('switch', { name: 'Reduce motion', exact: true })).toHaveAttribute('aria-checked', 'true')
  await page.getByTestId('tab-today').click()

  const addFood = page.getByTestId('today-add-entry')
  await expect(addFood).toHaveCSS('transition-property', 'none')
  await expect(addFood).toHaveCSS('transition-duration', '0s')
  await addFood.focus()
  await page.keyboard.down('Space')
  await expect(addFood).toHaveCSS('transform', 'none')
  await page.keyboard.up('Space')

  const sheet = page.getByTestId('bottom-sheet')
  await expect(sheet).toHaveCount(1)
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Close', exact: true }).focus()
  await page.keyboard.press('Shift+Tab')
  expect(await sheet.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(addFood).toBeFocused()

  // Repeated keyboard openings must neither lose the trigger nor leave dialogs behind.
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.keyboard.press('Enter')
    await expect(sheet).toHaveCount(1)
    await expect.poll(() => sheet.evaluate((element) => element.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(addFood).toBeFocused()
  }

  await page.keyboard.press('Enter')
  await sheet.getByRole('tab', { name: 'Quick', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/log\/quick-add\?meal=/)
  await expect(sheet).toHaveCount(0)
  expect(await page.locator('body').evaluate((body) => getComputedStyle(body).overflow)).not.toBe('hidden')

  await page.getByRole('link', { name: 'Back', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('targets-card')).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await page.getByTestId('tab-log').focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('/log')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await expect(sheet).toHaveCount(0)
})
