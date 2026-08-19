import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'

async function onboard(page: Page) {
  // Dead-zone hour (00:00-4:59) so the Phase 10.3 meal prompt never fires and
  // blocks this test's own interactions -- these tests don't care what time
  // it is, they just need it to not be a live meal window.
  await page.clock.setFixedTime(new Date('2026-08-18T02:00:00'))
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()
  await page.getByPlaceholder('Your name').fill('History Persona')
  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByPlaceholder('years').fill('28')
  await page.getByPlaceholder('cm').fill('170')
  await page.getByPlaceholder('kg').fill('70')
  await page.getByLabel('Activity level').selectOption('sedentary')
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL('/')
}

// Fixture persona kcal target = 1628 (see goalEngine.test.ts), so 110% = 1790.8.
test('navigate to a past day, edit an entry, verify the calendar color updates', async ({ page }) => {
  await onboard(page)

  // Onboarding stamps the target's effectiveDate as today, so a day before that
  // has no target in effect yet ("none" band) — seed an earlier-dated target
  // directly in IndexedDB so 2026-08-10 has real coverage to test against,
  // simulating an account that already existed with this goal back then.
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('macrodesi')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('targets', 'readwrite')
        tx.objectStore('targets').add({
          effectiveDate: '2026-08-01',
          kcal: 1628,
          proteinG: 126,
          carbsG: 171,
          fatG: 49,
          source: 'computed',
        })
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  })

  // Log directly onto a known past day (2026-08-10) via the same route DayDetailPage's
  // "+ Add food" link would produce — 1 idli (40g, 41 kcal) keeps that day comfortably green.
  await page.goto('/log/add?meal=lunch&date=2026-08-10')
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByRole('button', { name: 'Add to Lunch' }).click()
  await expect(page).toHaveURL('/history/2026-08-10')

  await page.goto('/history')
  await expect(page.getByTestId('day-2026-08-10')).toHaveAttribute('data-band', 'green')

  await page.getByTestId('day-2026-08-10').click()
  await expect(page).toHaveURL('/history/2026-08-10')
  await expect(page.getByTestId('day-total-kcal')).toHaveText('41 / 1628 kcal')

  // Bump quantity way up so the day crosses into the red band (>1790.8 kcal).
  await page.getByRole('button', { name: 'Edit Idli' }).click()
  await page.getByLabel('Quantity').fill('50') // 50 x 40g = 2000g -> 2050 kcal
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL('/history/2026-08-10')
  await expect(page.getByTestId('day-total-kcal')).toHaveText('2050 / 1628 kcal')

  await page.getByRole('link', { name: '← Back to calendar' }).click()
  await expect(page).toHaveURL('/history')
  await expect(page.getByTestId('day-2026-08-10')).toHaveAttribute('data-band', 'red')
})

test('future days in the calendar are not clickable', async ({ page }) => {
  await onboard(page)
  await page.goto('/history')

  // 2026-08-18 is "today" in this fixture's system clock; any later day in the
  // rendered month should be greyed out and non-interactive.
  const futureCell = page.getByTestId('day-2026-08-25')
  await expect(futureCell).toBeVisible()
  await expect(futureCell).not.toHaveAttribute('href', /.+/)
})

test('weight tracking: log a weigh-in and see it plus the trend chart', async ({ page }) => {
  await onboard(page)
  await page.goto('/weight')

  await page.getByLabel('Weight (kg)').fill('79.5')
  await page.getByRole('button', { name: 'Log' }).click()

  await expect(page.getByTestId('weighin-list')).toContainText('79.5 kg')
  await expect(page.getByTestId('weight-chart')).toBeVisible()
})
