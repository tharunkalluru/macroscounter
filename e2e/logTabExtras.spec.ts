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

test('the "See all" link on Your usuals opens the full screen, and a repeated combo can be one-tap logged', async ({
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
  if (await notNow.isVisible().catch(() => false)) await notNow.click()
  await expect(page.getByTestId('your-usuals-row')).toBeVisible()
  await page.getByTestId('your-usuals-see-all').click()
  await expect(page).toHaveURL('/log/usuals')

  await expect(page.getByTestId('usuals-item').first()).toContainText('logged 2×')
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
