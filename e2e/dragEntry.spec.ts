import { expect, type Locator, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'Drag Entry Persona' })
}

// Use actual mouse movement so scrolling and hit testing match a person's drag.
async function dragEntryToMeal(page: Page, handle: Locator, dropZone: Locator) {
  await dropZone.scrollIntoViewIfNeeded()
  const start = await handle.boundingBox()
  const end = await dropZone.boundingBox()
  if (!start || !end) throw new Error('Missing drag target')
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 20 })
  await page.mouse.up()
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
