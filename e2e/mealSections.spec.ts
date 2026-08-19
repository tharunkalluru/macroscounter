import { expect, type Locator, type Page } from '@playwright/test'
import { test } from '@playwright/test'

async function swipeToDelete(page: Page, row: Locator) {
  await row.scrollIntoViewIfNeeded()
  const box = await row.boundingBox()
  if (!box) throw new Error('row not found for swipe-to-delete')
  const startX = box.x + box.width - 20
  const startY = box.y + box.height / 2
  const pointerInit = (x: number) => ({
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: x,
    clientY: startY,
  })
  await row.dispatchEvent('pointerdown', pointerInit(startX))
  for (let i = 1; i <= 7; i++) {
    await row.dispatchEvent('pointermove', pointerInit(startX - i * 15))
    await page.waitForTimeout(16)
  }
  await row.dispatchEvent('pointerup', { ...pointerInit(startX - 105), buttons: 0 })
}

async function onboard(page: Page) {
  // Dead-zone hour (00:00-4:59) so the Phase 10.3 meal prompt never fires and
  // blocks this test's own interactions -- these tests don't care what time
  // it is, they just need it to not be a live meal window.
  await page.clock.setFixedTime(new Date('2026-08-18T02:00:00'))
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()
  await page.getByPlaceholder('Your name').fill('Meal Section Persona')
  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByPlaceholder('years').fill('28')
  await page.getByPlaceholder('cm').fill('170')
  await page.getByPlaceholder('kg').fill('70')
  await page.getByLabel('Activity level').selectOption('sedentary')
  await page.getByRole('button', { name: 'Get started' }).click()
  await expect(page).toHaveURL('/')
}

async function seedLogEntry(
  page: Page,
  entry: {
    date: string
    meal: string
    foodId: string
    name: string
    portionSummary: string
    portionLabel: string
    qty: number
    unit: string
    grams: number
    kcal: number
    p: number
    c: number
    f: number
  }
) {
  await page.evaluate((e) => {
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('macrodesi')
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('logEntries', 'readwrite')
        tx.objectStore('logEntries').add(e)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }
      req.onerror = () => reject(req.error)
    })
  }, entry)
}

test('food rows show portions in household units, never a raw multiplier', async ({ page }) => {
  await onboard(page)

  await page.getByTestId('add-breakfast').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByLabel('Quantity').fill('3')
  await page.getByRole('button', { name: 'Add to Breakfast' }).click()

  const row = page.getByRole('button', { name: 'Edit Idli' })
  await expect(row).toContainText('3 idli')
  await expect(row).not.toContainText('3 x 1 idli')
})

test('the overflow menu is present and opens on all four meal cards', async ({ page }) => {
  await onboard(page)

  for (const meal of ['breakfast', 'lunch', 'snacks', 'dinner']) {
    await page.getByTestId(`meal-overflow-${meal}`).click()
    await expect(page.getByTestId('meal-overflow-menu')).toBeVisible()
    await expect(page.getByTestId('overflow-save-template')).toBeVisible()
    await expect(page.getByTestId('overflow-log-template')).toBeVisible()
    await expect(page.getByTestId('overflow-copy-yesterday')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('bottom-sheet')).not.toBeVisible()
  }
})

test('swipe-delete shows an undo snackbar that restores the entry and totals', async ({ page }) => {
  await onboard(page)

  await page.getByTestId('add-dinner').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByRole('button', { name: 'Add to Dinner' }).click()
  await expect(page.getByTestId('meal-subtotal-dinner')).toHaveText('41 kcal')

  await swipeToDelete(page, page.getByRole('button', { name: 'Edit Idli' }))
  await expect(page.getByTestId('meal-subtotal-dinner')).toHaveText('0 kcal')
  await expect(page.getByTestId('snackbar')).toContainText('Deleted Idli')

  await page.getByTestId('snackbar-action').click()
  await expect(page.getByTestId('meal-subtotal-dinner')).toHaveText('41 kcal')
  await expect(page.getByRole('button', { name: 'Edit Idli' })).toBeVisible()
})

test('copy from yesterday clones the previous day\'s entries for that meal into today', async ({ page }) => {
  await onboard(page) // pins the clock to 2026-08-18T02:00 (see onboard())

  await seedLogEntry(page, {
    date: '2026-08-17',
    meal: 'dinner',
    foodId: 'idli',
    name: 'Idli',
    portionSummary: '3 x 1 idli',
    portionLabel: '1 idli',
    qty: 3,
    unit: 'portion',
    grams: 120,
    kcal: 123,
    p: 5.4,
    c: 24,
    f: 0.6,
  })

  await page.reload()
  await expect(page.getByTestId('meal-subtotal-dinner')).toHaveText('0 kcal')

  await page.getByTestId('meal-overflow-dinner').click()
  await page.getByTestId('overflow-copy-yesterday').click()

  await expect(page.getByTestId('meal-subtotal-dinner')).toHaveText('123 kcal')
  await expect(page.getByRole('button', { name: 'Edit Idli' })).toContainText('3 idli')
})

test('an empty meal with a repeated history shows a one-tap "your usual" suggestion chip', async ({ page }) => {
  await onboard(page) // pins the clock to 2026-08-18T02:00 (see onboard())

  for (const date of ['2026-08-12', '2026-08-14', '2026-08-16']) {
    await seedLogEntry(page, {
      date,
      meal: 'dinner',
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
  }

  await page.reload()
  const chip = page.getByTestId('suggestion-chip-dinner')
  await expect(chip).toBeVisible()
  await expect(chip).toContainText('Idli')

  await chip.click()
  await expect(page.getByTestId('meal-subtotal-dinner')).toHaveText('82 kcal')
})
