import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Meal Prompt Persona', fixedTime: false })
}

async function seedBreakfastHistory(page: Page) {
  for (const date of ['2026-08-12', '2026-08-14', '2026-08-16']) {
    await page.evaluate((d) => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('macrodesi')
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('logEntries', 'readwrite')
          tx.objectStore('logEntries').add({
            date: d,
            meal: 'breakfast',
            foodId: 'idli',
            name: 'Idli',
            portionSummary: '2 x 1 idli',
            portionLabel: '1 idli',
            qty: 2,
            unit: 'portion',
            grams: 80,
            kcal: 82,
            p: 3.6,
            c: 16,
            f: 0.4,
          })
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
        req.onerror = () => reject(req.error)
      })
    }, date)
  }
}

test('opening the app at 08:00 with an empty breakfast shows the prompt, with a working suggestion chip', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-08-18T08:00:00'))
  await onboard(page)
  await seedBreakfastHistory(page)

  await page.reload()

  await expect(page.getByTestId('meal-prompt-sheet')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Log breakfast?' })).toBeVisible()

  const chip = page.getByTestId('meal-prompt-suggestion-chip')
  await expect(chip).toBeVisible()
  await expect(chip).toContainText('Idli')

  await chip.click()

  await expect(page.getByTestId('meal-prompt-sheet')).not.toBeVisible()
  await expect(page.getByTestId('meal-subtotal-breakfast')).toHaveText('82 kcal')
})

test('"Not now" dismisses the prompt and it does not reappear for that window today', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-18T08:00:00'))
  await onboard(page)

  await expect(page.getByTestId('meal-prompt-sheet')).toBeVisible()
  await page.getByTestId('meal-prompt-not-now-button').click()
  await expect(page.getByTestId('meal-prompt-sheet')).not.toBeVisible()

  await page.reload()
  await expect(page.getByTestId('meal-prompt-sheet')).not.toBeVisible()
  // Breakfast is still genuinely empty — this isn't "no prompt because logged".
  await expect(page.getByTestId('meal-subtotal-breakfast')).toHaveText('0 kcal')
})

test('the Search button opens the add-food sheet for the prompted meal and closes the prompt', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-18T08:00:00'))
  await onboard(page)

  await expect(page.getByTestId('meal-prompt-sheet')).toBeVisible()
  await page.getByTestId('meal-prompt-search-button').click()

  await expect(page.getByTestId('meal-prompt-sheet')).not.toBeVisible()
  await expect(page.getByTestId('bottom-sheet')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Add to Breakfast' })).toBeVisible()

  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByTestId('log-entry-button').click()
  await expect(page.getByTestId('meal-subtotal-breakfast')).toHaveText('41 kcal')
})

test('no prompt appears during the 00:00-4:59 dead zone', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-18T02:30:00'))
  await onboard(page)

  await expect(page.getByTestId('meal-prompt-sheet')).not.toBeVisible()
})

test('logging breakfast normally means no prompt shows on the next app open', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-18T08:00:00'))
  await onboard(page)

  await page.getByTestId('meal-prompt-not-now-button').click()
  await page.getByTestId('add-breakfast').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByTestId('log-entry-button').click()
  await expect(page.getByTestId('meal-subtotal-breakfast')).toHaveText('41 kcal')

  await page.reload()
  await expect(page.getByTestId('meal-prompt-sheet')).not.toBeVisible()
})
