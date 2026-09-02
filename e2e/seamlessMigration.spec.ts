import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'

/**
 * Phase F.8 — an explicit check that an account created before this whole
 * redesign shipped (old onboarding-option vocabulary, no `LogEntry.loggedAt`,
 * a 'system' theme preference) still renders correctly under the new UI with
 * nothing dropped and nothing crashing. Seeds IndexedDB directly with
 * pre-shape data rather than driving the (now different) onboarding UI,
 * matching this repo's existing seed-via-indexedDB pattern.
 */
async function seedPreExistingAccount(page: Page) {
  await page.addInitScript(() => localStorage.setItem('macrodesi-theme', 'system'))
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('macrodesi')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction(['profiles', 'targets', 'logEntries', 'weighIns'], 'readwrite')

        tx.objectStore('profiles').add({
          name: 'Legacy Persona',
          sex: 'female',
          age: 34,
          heightCm: 165,
          weightKg: 68,
          activityLevel: 'light',
          goal: 'cut',
          // Pre-Phase-F.2 shape: old single tracking-experience question,
          // pre-Keto diet style, no goalWeightKg, no dateOfBirth.
          weightHistoryClass: 'yo_yo',
          dietStyle: 'higher_fat',
          proteinPriority: 'standard',
          calorieFloorChoice: 'standard',
        })
        tx.objectStore('targets').add({
          effectiveDate: '2026-01-01',
          kcal: 1700,
          proteinG: 120,
          carbsG: 150,
          fatG: 55,
          source: 'computed',
        })
        // Pre-Phase-F.3 shape: no loggedAt at all on these rows. Dated
        // "today" (the test's fixed clock) so it shows up on the Dashboard.
        tx.objectStore('logEntries').add({
          date: '2026-08-18',
          meal: 'breakfast',
          name: 'Legacy Idli',
          portionSummary: '3 pieces',
          qty: 3,
          unit: 'portion',
          grams: 120,
          kcal: 300,
          p: 12,
          c: 55,
          f: 4,
        })
        tx.objectStore('weighIns').add({ date: '2026-08-18', weightKg: 68 })

        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  })
}

test('an account with pre-redesign data renders correctly with nothing dropped', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-18T09:00:00'))
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()
  await expect(page).toHaveURL(/\/onboarding$/)

  await seedPreExistingAccount(page)
  await page.goto('/')

  // Today renders the legacy target/entry with no crash.
  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('kcal-target')).toHaveText('1700 kcal target')
  await expect(page.getByTestId('today-view')).toContainText('Legacy Idli')

  // The 'system' theme preference migrated to a concrete value, not lost.
  const migratedTheme = await page.evaluate(() => localStorage.getItem('macrodesi-theme'))
  expect(['light', 'dark']).toContain(migratedTheme)
  const htmlHasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  expect(htmlHasDark).toBe(migratedTheme === 'dark')

  // The Log tab's Timeline view buckets the loggedAt-less legacy entry under
  // breakfast's fallback hour rather than hiding it.
  await page.goto('/log')
  await page.getByTestId('log-tab-timeline').click()
  await expect(page.getByTestId('timeline-view')).toContainText('Legacy Idli')

  // The weigh-in and profile edit surfaces still work against the old profile shape.
  await page.goto('/weight')
  await expect(page.getByTestId('weighin-list')).toContainText('68')

  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'You', exact: true })).toBeVisible()
})
