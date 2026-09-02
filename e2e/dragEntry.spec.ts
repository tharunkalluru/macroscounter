import { expect, type Locator, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Drag Entry Persona' })
}

// dnd-kit's PointerSensor listens for real pointer events (not the native
// HTML5 Drag and Drop API), and its default collision detection tracks the
// accumulated pointer delta rather than page.mouse's OS-level coordinates --
// coordinate-based `dragTo()` proved unreliable in this suite for the same
// reason framer-motion's own drag gesture needed direct pointer-event
// dispatch (see swipeToDelete in logging.spec.ts). Mirrors that same pattern.
async function dragEntryToMeal(page: Page, handle: Locator, dropZone: Locator) {
  const handleBox = await handle.boundingBox()
  const dropBox = await dropZone.boundingBox()
  if (!handleBox || !dropBox) throw new Error('drag handle or drop zone not found')

  const startX = handleBox.x + handleBox.width / 2
  const startY = handleBox.y + handleBox.height / 2
  const endX = dropBox.x + dropBox.width / 2
  const endY = dropBox.y + dropBox.height / 2

  const pointerInit = (x: number, y: number) => ({
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: x,
    clientY: y,
  })

  await handle.dispatchEvent('pointerdown', pointerInit(startX, startY))
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps
    const y = startY + ((endY - startY) * i) / steps
    await handle.dispatchEvent('pointermove', pointerInit(x, y))
    await page.waitForTimeout(16)
  }
  await handle.dispatchEvent('pointerup', { ...pointerInit(endX, endY), buttons: 0 })
}

test('dragging an entry by its handle moves it into the dropped-on meal section', async ({ page }) => {
  await onboard(page)
  await page.goto('/log')

  await page.getByTestId('add-breakfast').click()
  await page.getByPlaceholder('Search foods (e.g. idli, sambar)').fill('idli')
  await page.getByTestId('search-results').getByRole('button', { name: 'Idli', exact: true }).click()
  await page.getByTestId('log-entry-button').click()

  await expect(page.getByTestId('meal-subtotal-breakfast')).toHaveText('41 kcal')
  await expect(page.getByTestId('meal-subtotal-lunch')).toHaveText('0 kcal')

  const entryId = await page.getByTestId(/^entry-row-\d+$/).getAttribute('data-testid')
  const handle = page.getByTestId(`entry-drag-handle-${entryId!.replace('entry-row-', '')}`)
  const lunchDropZone = page.getByTestId('meal-drop-zone-lunch')

  await dragEntryToMeal(page, handle, lunchDropZone)

  await expect(page.getByTestId('meal-subtotal-breakfast')).toHaveText('0 kcal')
  await expect(page.getByTestId('meal-subtotal-lunch')).toHaveText('41 kcal')
  await expect(lunchDropZone).toContainText('Idli')
})
