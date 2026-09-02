import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, {
    name: 'Coach Persona',
    age: '25',
    heightCm: '180',
    weightKg: '90',
    activityLevel: 'active',
  })
  // Fixture persona target: BMR 1905, TDEE 3286.125, cut -500 -> 2786 kcal.
  await expect(page.getByTestId('kcal-target')).toHaveText('2786 kcal target')
}

/** Same plateau-week fixture as adaptive.spec.ts — 7 days at target, flat weight. */
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
        weighInStore.add({ date: '2026-08-18', weightKg: 90.0 })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  })
}

test('the strategy hub shows week 1 for a freshly onboarded program', async ({ page }) => {
  await onboard(page)
  await page.goto('/coach')

  await expect(page.getByTestId('strategy-card')).toBeVisible()
  await expect(page.getByTestId('strategy-week')).toHaveText('Week 1')
  await expect(page.getByTestId('strategy-past-programs')).not.toBeVisible()
})

test('the weekly check-in says there is nothing to check in on yet without a full week of data', async ({
  page,
}) => {
  await onboard(page)
  await page.goto('/coach/check-in')

  await expect(page.getByTestId('checkin-none')).toBeVisible()
})

test('walking through the weekly check-in wizard and accepting updates the target', async ({ page }) => {
  await onboard(page)
  await seedPlateauWeek(page)

  await page.goto('/coach/check-in')

  await expect(page.getByTestId('checkin-step-intro')).toBeVisible()
  await page.getByTestId('checkin-continue').click()

  await expect(page.getByTestId('checkin-step-your-week')).toBeVisible()
  await expect(page.getByTestId('checkin-avg-kcal')).toHaveText('2786 kcal')
  await expect(page.getByTestId('checkin-weight-change')).toHaveText('0 kg')
  await page.getByTestId('checkin-continue').click()

  await expect(page.getByTestId('checkin-step-the-math')).toBeVisible()
  await expect(page.getByTestId('checkin-adjustment')).toHaveText('-100 kcal')
  await expect(page.getByTestId('checkin-reason')).toContainText('lowering your target by 100 kcal')
  await page.getByTestId('checkin-continue').click()

  await expect(page.getByTestId('checkin-step-new-target')).toBeVisible()
  await expect(page.getByTestId('checkin-suggested-kcal')).toHaveText('2686 kcal')

  // Back navigation steps backward through the wizard, not out of it.
  await page.getByTestId('checkin-back').click()
  await expect(page.getByTestId('checkin-step-the-math')).toBeVisible()
  await page.getByTestId('checkin-continue').click()

  await page.getByTestId('checkin-accept').click()
  await expect(page).toHaveURL('/coach/check-in/plan')
  await expect(page.getByTestId('program-update-grid')).toContainText('2686')

  await page.getByTestId('program-update-use-plan').click()
  await expect(page).toHaveURL('/coach')

  await page.goto('/')
  await expect(page.getByTestId('kcal-target')).toHaveText('2686 kcal target')
})

test('keeping the current target from the wizard leaves the target unchanged', async ({ page }) => {
  await onboard(page)
  await seedPlateauWeek(page)

  await page.goto('/coach/check-in')
  await page.getByTestId('checkin-continue').click()
  await page.getByTestId('checkin-continue').click()
  await page.getByTestId('checkin-continue').click()

  await page.getByTestId('checkin-keep-current').click()
  await expect(page).toHaveURL('/coach')

  await page.goto('/')
  await expect(page.getByTestId('kcal-target')).toHaveText('2786 kcal target')
})

test('reaching a goal weight shows the full-screen takeover on the next app open, once', async ({ page }) => {
  await onboard(page)

  await page.goto('/settings')
  await page.getByTestId('goal-weight-input').fill('90')
  await page.getByRole('button', { name: 'Save & recalculate' }).click()
  await expect(page.getByText('Saved — targets recalculated.')).toBeVisible()

  await page.goto('/weight')
  // Three weigh-ins at the goal weight -> projectGoalWeight resolves 'at-goal'.
  // Waiting for each row to land before the next submission avoids racing
  // WeightSection's own async save (its Log button has no submitting-disabled guard).
  for (const date of ['2026-08-10', '2026-08-14', '2026-08-18']) {
    await page.getByTestId('weight-input-kg').fill('90')
    await page.locator('input[type="date"]').fill(date)
    await page.getByRole('button', { name: 'Log' }).click()
    await expect(page.getByTestId('weighin-list')).toContainText(date)
  }

  // Not shown reactively at log time -- only checked once per app open.
  await expect(page.getByTestId('goal-reached-takeover')).not.toBeVisible()

  // A fresh navigation is "the next app open".
  await page.goto('/coach')
  await expect(page.getByTestId('goal-reached-takeover')).toBeVisible()
  await expect(page.getByTestId('goal-reached-takeover')).toContainText("You're there")

  await page.getByTestId('goal-reached-new-goal').click()
  await expect(page).toHaveURL('/settings')

  // Doesn't reappear on the next open -- it's a one-shot per goal value.
  await page.goto('/coach')
  await expect(page.getByTestId('goal-reached-takeover')).not.toBeVisible()
})
