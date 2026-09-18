import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Log Extras Persona' })
}

test('Timeline view groups a newly-logged entry under the current hour', async ({ page }) => {
  await onboard(page)
  await page.getByTestId('fab-scan').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByTestId('log-entry-button').click()
  await expect(page.getByTestId('bottom-sheet')).not.toBeVisible()

  await page.goto('/log')
  await page.getByTestId('log-tab-timeline').click()
  await expect(page.getByTestId('timeline-view')).toContainText('Idli')
})

async function seedIdliBreakfast(page: Page, date: string) {
  await page.evaluate((date) => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('macrodesi')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('logEntries', 'readwrite')
        tx.objectStore('logEntries').add({
          date,
          meal: 'breakfast',
          foodId: 'idli',
          name: 'Idli',
          portionSummary: '1 idli',
          qty: 1,
          unit: 'portion',
          grams: 40,
          kcal: 41,
          p: 2,
          c: 8,
          f: 0.2,
        })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  }, date)
}

test('the recent meals link opens the full screen, and a repeated combo can be one-tap logged', async ({
  page,
}) => {
  await onboard(page)

  // Seeded directly (rather than repeating the add-food UI flow) so this
  // exercises the suggestions ranking itself, not the logging sheet twice.
  await seedIdliBreakfast(page, '2026-08-16')
  await seedIdliBreakfast(page, '2026-08-17')

  await page.clock.setFixedTime(new Date('2026-08-18T08:00:00'))
  await page.goto('/')
  const notNow = page.getByTestId('meal-prompt-not-now-button')
  await expect(notNow).toBeVisible()
  await notNow.click()
  await expect(page.getByTestId('repeat-meals-card')).toBeVisible()
  await page.getByRole('link', { name: 'All recent meals' }).click()
  await expect(page).toHaveURL('/log/usuals?date=2026-08-18&meal=breakfast')

  await page.getByTestId('meal-suggestion-details-toggle').first().click()
  await expect(page.getByTestId('meal-suggestion-details').first()).toContainText('Logged 2×')
  await page.getByTestId('usuals-item').first().click()
  await expect(page.getByTestId('usuals-item').first()).toContainText('Logged')
})

test('a full-screen weigh-in save shows up in the weight trend chart', async ({ page }) => {
  await onboard(page)
  await page.goto('/weight')
  await page.getByTestId('weighin-entry-link').click()
  await expect(page).toHaveURL('/weight/entry')

  for (const key of ['7', '9', '.', '5']) {
    await page.getByTestId(`weighin-key-${key}`).click()
  }
  await expect(page.getByTestId('weighin-buffer')).toHaveText('79.5')

  await page.getByTestId('weighin-save').click()
  await expect(page).toHaveURL('/weight')
  await expect(page.getByTestId('weighin-list')).toContainText('79.5 kg')
})


test('repeating an AI meal preserves its portions and chosen historical destination', async ({ page }) => {
  await onboard(page)
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('macrodesi')
    request.onsuccess = () => {
      const tx = request.result.transaction('logEntries', 'readwrite')
      tx.objectStore('logEntries').add({ date: '2026-08-15', meal: 'dinner', name: 'AI noodle bowl', portionSummary: '1 large bowl', qty: 1, unit: 'portion', grams: 420, kcal: 650, p: 30, c: 85, f: 20, fiber: 9 })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }
    request.onerror = () => reject(request.error)
  }))
  await page.goto('/log/usuals?date=2026-08-17&meal=dinner')
  await expect(page.getByTestId('usuals-filter-dinner')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('meal-suggestion-row')).toContainText('1 large bowl')
  await page.getByTestId('usuals-item').click()
  await expect(page.getByRole('status')).toContainText('Meal added')
  await page.goto('/log?date=2026-08-17')
  await expect(page.getByTestId('meal-section-dinner')).toContainText('AI noodle bowl')
  await expect(page.getByTestId('diary-day-total')).toContainText('650 kcal')
  await page.reload()
  await expect(page.getByTestId('diary-day-total')).toContainText('650 kcal')
  await page.goto('/')
  await expect(page.getByTestId('figure-eaten')).toContainText('0')
})
