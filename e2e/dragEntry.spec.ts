import { expect, type Locator, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Drag Entry Persona' })
}

// dnd-kit's MouseSensor (used for non-touch input -- see LogPage.tsx's
// separate Mouse/TouchSensor setup, split so touch gets a long-press
// activation distinct from mouse's near-immediate one) listens for native
// `mousedown`/`mousemove`/`mouseup`, not the HTML5 Drag and Drop API and not
// Pointer Events either -- coordinate-based `dragTo()` proved unreliable in
// this suite for the same reason framer-motion's own drag gesture needed
// direct event dispatch (see swipeToDelete in logging.spec.ts). Mirrors that
// same pattern with the event type MouseSensor actually listens for.
async function dragEntryToMeal(page: Page, handle: Locator, dropZone: Locator) {
  const handleBox = await handle.boundingBox()
  const dropBox = await dropZone.boundingBox()
  if (!handleBox || !dropBox) throw new Error('drag handle or drop zone not found')

  const startX = handleBox.x + handleBox.width / 2
  const startY = handleBox.y + handleBox.height / 2
  const endX = dropBox.x + dropBox.width / 2
  const endY = dropBox.y + dropBox.height / 2

  const mouseInit = (x: number, y: number) => ({
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    buttons: 1,
    clientX: x,
    clientY: y,
  })

  await handle.dispatchEvent('mousedown', mouseInit(startX, startY))
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    const x = startX + ((endX - startX) * i) / steps
    const y = startY + ((endY - startY) * i) / steps
    await handle.dispatchEvent('mousemove', mouseInit(x, y))
    await page.waitForTimeout(16)
  }
  await handle.dispatchEvent('mouseup', { ...mouseInit(endX, endY), buttons: 0 })
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
