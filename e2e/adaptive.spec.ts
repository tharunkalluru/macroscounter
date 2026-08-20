import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, {
    name: 'Adaptive Persona',
    age: '25',
    heightCm: '180',
    weightKg: '90',
    activityLevel: 'active',
  })
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
  await onboard(page) // pins the clock to 2026-08-18T02:00 (see onboard())
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
  await onboard(page) // pins the clock to 2026-08-18T02:00 (see onboard())
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
