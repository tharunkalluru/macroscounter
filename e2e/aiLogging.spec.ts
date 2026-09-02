import { expect, type Page } from '@playwright/test'
import { test } from '@playwright/test'
import { onboard as onboardHelper } from './helpers/onboard'

async function onboard(page: Page) {
  await onboardHelper(page, { name: 'AI Logging Persona' })
}

// AI logging requires a signed-in session -- mock better-auth's session
// endpoint so useSession() resolves to a signed-in user without a real
// Google OAuth round-trip (not automatable in this suite).
async function mockSignedIn(page: Page) {
  await page.route('**/api/auth/get-session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        session: { id: 'sess_1', userId: 'user_1', expiresAt: new Date(Date.now() + 3600_000).toISOString() },
        user: {
          id: 'user_1',
          email: 'persona@example.com',
          name: 'AI Logging Persona',
          image: null,
          emailVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    })
  )
}

async function openAiTab(page: Page) {
  await page.getByTestId('fab-scan').click() // 02:00 fixed clock -> defaults to breakfast
  await expect(page.getByTestId('bottom-sheet')).toBeVisible()
  await page.getByTestId('sheet-tab-ai').click()
  await expect(page).toHaveURL(/\/log\/ai\?meal=breakfast/)
}

test('a guest is prompted to sign in instead of seeing the AI input screen', async ({ page }) => {
  await onboard(page)
  await openAiTab(page)

  await expect(page.getByText('Sign in to use AI logging')).toBeVisible()
  await expect(page.getByTestId('ai-signin-button')).toBeVisible()
  await expect(page.getByTestId('ai-description-input')).not.toBeVisible()
})

test('describing a meal in text analyses it and logs the result', async ({ page }) => {
  await onboard(page)
  const kcalBefore = Number(await page.getByTestId('kcal-remaining').textContent())
  await mockSignedIn(page)
  await page.reload()
  await openAiTab(page)

  await page.route('**/api/ai/analyze', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            name: 'Grilled chicken breast',
            gramsEstimate: 100,
            kcal: 165,
            proteinG: 31,
            carbsG: 0,
            fatG: 4,
            confidence: 'high',
          },
        ],
      }),
    })
  )

  await page.getByTestId('ai-description-input').fill('100g grilled chicken breast')
  await page.getByTestId('ai-analyse-button').click()

  await expect(page).toHaveURL('/log/ai/result')
  await expect(page.getByTestId('ai-result-list')).toContainText('Grilled chicken breast')
  await expect(page.getByTestId('ai-result-list')).toContainText('165 kcal · 31P 0C 4F')

  await page.getByTestId('ai-log-all-button').click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('kcal-remaining')).toHaveText(String(kcalBefore - 165))
})

test('a low-confidence (photo-estimated) item shows the size-estimated flag', async ({ page }) => {
  await onboard(page)
  await mockSignedIn(page)
  await page.reload()
  await openAiTab(page)

  await page.route('**/api/ai/analyze', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            name: 'Mixed vegetable curry',
            gramsEstimate: 180,
            kcal: 210,
            proteinG: 6,
            carbsG: 22,
            fatG: 11,
            confidence: 'low',
          },
        ],
      }),
    })
  )

  await page.getByTestId('ai-description-input').fill('a bowl of mixed vegetable curry')
  await page.getByTestId('ai-analyse-button').click()

  await expect(page).toHaveURL('/log/ai/result')
  await expect(page.getByTestId('ai-result-item-0')).toContainText('size estimated')
})

test('a missing API key shows a clear fallback message instead of a raw error', async ({ page }) => {
  await onboard(page)
  await mockSignedIn(page)
  await page.reload()
  await openAiTab(page)

  await page.route('**/api/ai/analyze', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'AI logging is not configured yet.', code: 'missing_key' }),
    })
  )

  await page.getByTestId('ai-description-input').fill('two rotis with dal')
  await page.getByTestId('ai-analyse-button').click()

  await expect(page.getByTestId('ai-error-message')).toContainText("AI logging isn't set up yet")
  await expect(page).toHaveURL(/\/log\/ai\?meal=breakfast/)
})

test('selecting a photo shows a preview, and it can be removed before analysing', async ({ page }) => {
  await onboard(page)
  await mockSignedIn(page)
  await page.reload()
  await openAiTab(page)

  await expect(page.getByTestId('ai-photo-add')).toBeVisible()
  await page.getByTestId('ai-photo-input').setInputFiles({
    name: 'meal.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), // minimal JPEG-ish bytes; only the preview <img> matters here
  })

  await expect(page.getByTestId('ai-photo-preview')).toBeVisible()
  await expect(page.getByTestId('ai-analyse-button')).toBeEnabled()

  await page.getByTestId('ai-photo-remove').click()
  await expect(page.getByTestId('ai-photo-preview')).not.toBeVisible()
  await expect(page.getByTestId('ai-photo-add')).toBeVisible()
})
