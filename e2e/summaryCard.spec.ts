import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Journey Persona' })
}

// Fixture persona: kcal target 1628 (see goalEngine.test.ts).
test('over-budget: logging past the target turns the ring amber and shows "+n over"', async ({ page }) => {
  await onboard(page)
  await page.goto('/log') // meal-grouped breakdown lives on the Log tab's Meals view (Phase R.3)

  await page.getByTestId('add-lunch').click()
  await page.getByTestId('sheet-custom-button').click()
  await expect(page).toHaveURL(/\/log\/quick-add\?meal=lunch/)
  await page.getByLabel('Name').fill('Feast')
  await page.getByLabel('Calories (kcal)').fill('2000')
  await page.getByRole('button', { name: 'Add to Lunch' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('kcal-remaining')).toHaveText('+372') // 2000 - 1628
  await expect(page.getByTestId('calories-ring')).toHaveAccessibleName(/372 over/)

  const ringFillCircle = page.getByTestId('calories-ring').locator('circle').nth(1)
  // semantic.over[600] — the dedicated over-budget hue, distinct from
  // semantic.warn/carbs (Phase F.0 bug fix: CaloriesRing previously used
  // `warn` here, recreating the exact color ambiguity `over` exists to avoid).
  await expect(ringFillCircle).toHaveAttribute('stroke', '#bf7640')
})

test('under target: the ring stays brand-colored and shows plain remaining kcal', async ({ page }) => {
  await onboard(page)
  await page.goto('/log') // meal-grouped breakdown lives on the Log tab's Meals view (Phase R.3)

  await page.getByTestId('add-lunch').click()
  await page.getByTestId('sheet-custom-button').click()
  await page.getByLabel('Name').fill('Snack')
  await page.getByLabel('Calories (kcal)').fill('200')
  await page.getByRole('button', { name: 'Add to Lunch' }).click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('kcal-remaining')).toHaveText('1428') // 1628 - 200
  await expect(page.getByTestId('calories-ring')).toHaveAccessibleName('200 of 1628 calories remaining')

  const ringFillCircle = page.getByTestId('calories-ring').locator('circle').nth(1)
  await expect(ringFillCircle).toHaveAttribute('stroke', '#5340bf') // semantic.success[600]
})

test('tapping a macro bar opens the per-meal breakdown sheet with correct totals', async ({ page }) => {
  await onboard(page)

  await page.getByTestId('fab-scan').click() // 02:00 fixed clock -> defaults to breakfast
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByTestId('log-entry-button').click()
  await expect(page.getByTestId('bottom-sheet')).not.toBeVisible()

  await page.getByTestId('protein-bar').click()
  await expect(page.getByRole('heading', { name: 'Protein by meal' })).toBeVisible()

  const list = page.getByTestId('macro-breakdown-list')
  const breakfastRow = list.getByRole('listitem').filter({ hasText: 'Breakfast' })
  await expect(breakfastRow).toContainText('1.8 g')
  const lunchRow = list.getByRole('listitem').filter({ hasText: 'Lunch' })
  await expect(lunchRow).toContainText('0 g')

  await expect(page.getByTestId('macro-breakdown-total')).toHaveText('1.8 g')

  await page.keyboard.press('Escape')
  await expect(page.getByTestId('bottom-sheet')).not.toBeVisible()
})

test('an existing target created before fiber tracking still shows a real fiber goal, computed from the profile', async ({
  page,
}) => {
  await onboard(page)

  // Simulate an account whose current target row predates fiber tracking
  // (fiberG is a nullable, non-backfilled column) -- reinsert the same
  // target without it, matching what a pre-existing row actually looks like.
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('macrodesi')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('targets', 'readwrite')
        const store = tx.objectStore('targets')
        store.clear()
        store.add({ effectiveDate: '2026-08-18', kcal: 1628, proteinG: 126, carbsG: 171, fatG: 49, source: 'computed' })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  })
  await page.reload()

  // Protein/Carbs/Fat still show their real (pre-existing) targets...
  await expect(page.getByTestId('protein-bar-value')).toContainText('126 g')
  // ...and Fiber, despite the stored target lacking fiberG, shows a real
  // computed target (IOM Adequate Intake for a male, 28 -> 38g) instead of 0.
  await expect(page.getByTestId('fiber-bar-value')).toContainText('38 g')
})
