import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Goal Weight Persona' })
}

async function seedWeighIns(page: Page, points: { date: string; weightKg: number }[]) {
  await page.evaluate((points) => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('macrodesi')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('weighIns', 'readwrite')
        const store = tx.objectStore('weighIns')
        for (const p of points) store.add(p)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  }, points)
}

test('Trends is unchanged for a user who never sets a goal weight', async ({ page }) => {
  await onboard(page)
  await page.goto('/trends')
  await expect(page.getByTestId('goal-weight-card')).not.toBeVisible()
})

test('setting a goal weight in Settings surfaces a projected ETA on Trends', async ({ page }) => {
  await onboard(page)

  await seedWeighIns(page, [
    { date: '2026-08-01', weightKg: 80 },
    { date: '2026-08-08', weightKg: 79 },
    { date: '2026-08-15', weightKg: 78 },
  ])

  await page.goto('/settings')
  await page.getByTestId('goal-weight-input').fill('60')
  await page.getByRole('button', { name: 'Save & recalculate' }).click()
  await expect(page.getByText('Saved — targets recalculated.')).toBeVisible()

  await page.goto('/trends')
  const card = page.getByTestId('goal-weight-card')
  await expect(card).toBeVisible()
  await expect(card).toHaveAttribute('data-status', 'on-track')
  await expect(card).toContainText('60 kg')

  await page.goto('/weight')
  await expect(page.getByTestId('goal-weight-card')).toBeVisible()
})

test('clearing a previously-set goal weight removes the card', async ({ page }) => {
  await onboard(page)

  await seedWeighIns(page, [
    { date: '2026-08-01', weightKg: 80 },
    { date: '2026-08-08', weightKg: 79 },
    { date: '2026-08-15', weightKg: 78 },
  ])

  await page.goto('/settings')
  await page.getByTestId('goal-weight-input').fill('60')
  await page.getByRole('button', { name: 'Save & recalculate' }).click()
  await expect(page.getByText('Saved — targets recalculated.')).toBeVisible()

  await page.goto('/settings')
  await expect(page.getByTestId('goal-weight-input')).toHaveValue('60')
  await page.getByTestId('goal-weight-input').fill('')
  await page.getByRole('button', { name: 'Save & recalculate' }).click()
  await expect(page.getByText('Saved — targets recalculated.')).toBeVisible()

  await page.goto('/trends')
  await expect(page.getByTestId('goal-weight-card')).not.toBeVisible()
})
