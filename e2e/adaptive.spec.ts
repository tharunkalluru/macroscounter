import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'

async function onboard(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('Your name').fill('Adaptive Persona')
  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByPlaceholder('years').fill('25')
  await page.getByPlaceholder('cm').fill('180')
  await page.getByPlaceholder('kg').fill('90')
  await page.getByLabel('Activity level').selectOption('active')
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL('/')
  // Fixture persona target: BMR 1905, TDEE 3286.125, cut -500 -> 2786 kcal.
  await expect(page.getByTestId('kcal-target')).toHaveText('2786 kcal target')
}

/** Seeds 7 days of logEntries (following the target exactly, a plateau) plus 2 weigh-ins directly into IndexedDB. */
async function seedPlateauWeek(page: Page) {
  await page.evaluate(() => {
    const dates = ['2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18']
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('macrodesi')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction(['logEntries', 'weighIns'], 'readwrite')
        const logStore = tx.objectStore('logEntries')
        for (const date of dates) {
          logStore.add({
            date,
            meal: 'lunch',
            name: 'Seeded Meal',
            portionSummary: '1 serving',
            qty: 1,
            unit: 'portion',
            grams: 100,
            kcal: 2786,
            p: 0,
            c: 0,
            f: 0,
          })
        }
        const weighInStore = tx.objectStore('weighIns')
        weighInStore.add({ date: '2026-08-12', weightKg: 90.0 })
        weighInStore.add({ date: '2026-08-18', weightKg: 90.0 }) // plateau: no change
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  })
}

test('adaptive prompt appears with the correct suggestion and accepting updates the target', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-08-18T09:00:00'))
  await onboard(page)
  await seedPlateauWeek(page)

  await page.reload()

  await expect(page.getByTestId('adaptive-prompt')).toBeVisible()
  await expect(page.getByTestId('adaptive-headline')).toContainText('decrease your target to 2686 kcal')
  await expect(page.getByTestId('adaptive-reason')).toContainText('stayed about the same')
  await expect(page.getByTestId('adaptive-reason')).toContainText('lowering your target by 100 kcal')

  await page.getByRole('button', { name: 'Accept' }).click()

  await expect(page.getByTestId('adaptive-prompt')).not.toBeVisible()
  await expect(page.getByTestId('kcal-target')).toHaveText('2686 kcal target')

  // Reloading shouldn't re-suggest the same week's adjustment again.
  await page.reload()
  await expect(page.getByTestId('adaptive-prompt')).not.toBeVisible()
})

test('dismissing the adaptive prompt hides it and it stays hidden on reload', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-18T09:00:00'))
  await onboard(page)
  await seedPlateauWeek(page)

  await page.reload()
  await expect(page.getByTestId('adaptive-prompt')).toBeVisible()

  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByTestId('adaptive-prompt')).not.toBeVisible()

  await page.reload()
  await expect(page.getByTestId('adaptive-prompt')).not.toBeVisible()
  // Target is unchanged since the suggestion was dismissed, not accepted.
  await expect(page.getByTestId('kcal-target')).toHaveText('2786 kcal target')
})
