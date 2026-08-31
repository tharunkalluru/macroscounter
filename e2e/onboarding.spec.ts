import { expect, test } from '@playwright/test'

// Same fixture persona as the "male, sedentary, cut: BMR floor binds" case in
// src/domain/goals/goalEngine.test.ts — kcal 1628 / protein 126 / carbs 171 / fat 49.
test('completing onboarding computes and shows the correct kcal target on the dashboard', async ({
  page,
}) => {
  // Dead-zone hour (00:00-4:59) so the Phase 10.3 meal prompt never fires and
  // blocks this test's own dashboard interactions.
  await page.clock.setFixedTime(new Date('2026-08-18T02:00:00'))
  await page.goto('/')
  await expect(page).toHaveURL(/\/welcome$/)
  await page.getByTestId('signin-skip-button').click()
  await expect(page).toHaveURL(/\/onboarding$/)
  await expect(page.getByRole('heading', { name: 'What should we call you?' })).toBeVisible()

  await page.getByPlaceholder('Your name').fill('Fixture Persona')
  await page.getByTestId('onboarding-continue').click()

  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId('dob-input').fill('1998-01-01')
  await page.getByTestId('onboarding-continue').click()

  await page.getByPlaceholder('cm').fill('170')
  await page.getByPlaceholder('kg').fill('70')
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId('onboarding-continue').click() // weight-history: default
  await page.getByTestId('onboarding-continue').click() // body-fat: skip

  await page.getByTestId('activity-job-desk').click()
  await page.getByTestId('onboarding-continue').click()
  await page.getByTestId('activity-exercise-none').click()
  await page.getByTestId('onboarding-continue').click()
  await page.getByTestId('activity-movement-low').click()
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId('goal-cut').click()
  await page.getByTestId('onboarding-continue').click()

  await expect(page.getByTestId('goal-rate-value')).toHaveText('1.00 lb/week')
  await page.getByTestId('onboarding-continue').click() // goal-rate: default (1 lb/week = legacy 500 kcal deficit)

  await page.getByTestId('onboarding-continue').click() // diet-style/protein-priority/calorie-floor: defaults

  await expect(page.getByTestId('coach-reveal-target')).toHaveText('1628 kcal')
  await page.getByTestId('onboarding-continue').click() // coach-reveal

  await expect(page.getByTestId('onboarding-preview-kcal')).toHaveText('1628 kcal')
  await page.getByTestId('onboarding-finish').click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('kcal-target')).toHaveText('1628 kcal target')
  await expect(page.getByTestId('protein-bar-value')).toHaveText('0 / 126 g')
  await expect(page.getByTestId('carbs-bar-value')).toHaveText('0 / 171 g')
  await expect(page.getByTestId('fat-bar-value')).toHaveText('0 / 49 g')
})

// Same persona/formula as the cm/kg case above, entered via ft+in and lb
// instead: 5'9" -> feetInchesToCm(5,9) = 175.3 cm, 176 lb -> lbToKg(176) =
// 79.8 kg. male/28/sedentary/cut -> kcal 1759 / protein 144 / carbs 170 /
// fat 56 (verified directly against computeGoalTargets).
test('height/weight unit toggle: entering ft+in and lb converts to the same canonical metric target', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-08-18T02:00:00'))
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()

  await page.getByPlaceholder('Your name').fill('Imperial Persona')
  await page.getByTestId('onboarding-continue').click()

  await page.getByRole('radio', { name: 'male', exact: true }).check()
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId('dob-input').fill('1998-01-01')
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId('height-unit-ft_in').click()
  await page.getByTestId('height-input-feet').fill('5')
  await page.getByTestId('height-input-inches').fill('9')
  await page.getByTestId('weight-unit-lb').click()
  await page.getByTestId('weight-input-lb').fill('176')
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId('onboarding-continue').click() // weight-history: default
  await page.getByTestId('onboarding-continue').click() // body-fat: skip

  await page.getByTestId('activity-job-desk').click()
  await page.getByTestId('onboarding-continue').click()
  await page.getByTestId('activity-exercise-none').click()
  await page.getByTestId('onboarding-continue').click()
  await page.getByTestId('activity-movement-low').click()
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId('goal-cut').click()
  await page.getByTestId('onboarding-continue').click()
  await page.getByTestId('onboarding-continue').click() // goal-rate: default

  await page.getByTestId('onboarding-continue').click() // diet-style/protein-priority/calorie-floor: defaults
  await page.getByTestId('onboarding-continue').click() // coach-reveal

  await expect(page.getByTestId('onboarding-preview-kcal')).toHaveText('1759 kcal')
  await page.getByTestId('onboarding-finish').click()

  await expect(page).toHaveURL('/')
  await expect(page.getByTestId('kcal-target')).toHaveText('1759 kcal target')
  await expect(page.getByTestId('protein-bar-value')).toHaveText('0 / 144 g')
  await expect(page.getByTestId('carbs-bar-value')).toHaveText('0 / 170 g')
  await expect(page.getByTestId('fat-bar-value')).toHaveText('0 / 56 g')

  // The preference persists to Settings, still showing ft+in/lb.
  await page.getByTestId('avatar-link').click()
  await expect(page.getByTestId('height-unit-ft_in')).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('height-input-feet')).toHaveValue('5')
  await expect(page.getByTestId('height-input-inches')).toHaveValue('9')
  await expect(page.getByTestId('weight-unit-lb')).toHaveAttribute('aria-checked', 'true')
  // 176 lb rounds to 79.8 kg for canonical storage, which redisplays as
  // 175.9 lb -- an expected sub-pound artifact of rounding to one decimal on
  // each side of the round trip, not a conversion bug.
  await expect(page.getByTestId('weight-input-lb')).toHaveValue('175.9')
})

test('data persists across a reload after onboarding', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-18T02:00:00'))
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()

  await page.getByPlaceholder('Your name').fill('Reload Check')
  await page.getByTestId('onboarding-continue').click()

  await page.getByRole('radio', { name: 'female', exact: true }).check()
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId('dob-input').fill('2000-01-01')
  await page.getByTestId('onboarding-continue').click()

  await page.getByPlaceholder('cm').fill('165')
  await page.getByPlaceholder('kg').fill('60')
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId('onboarding-continue').click() // weight-history: default
  await page.getByTestId('onboarding-continue').click() // body-fat: skip

  await page.getByTestId('activity-job-physical').click()
  await page.getByTestId('onboarding-continue').click()
  await page.getByTestId('activity-exercise-frequent').click()
  await page.getByTestId('onboarding-continue').click()
  await page.getByTestId('activity-movement-high').click()
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId('onboarding-continue').click() // goal: default (cut)
  await page.getByTestId('onboarding-continue').click() // goal-rate: default

  await page.getByTestId('onboarding-continue').click() // diet-style/protein-priority/calorie-floor: defaults
  await page.getByTestId('onboarding-continue').click() // coach-reveal
  await page.getByTestId('onboarding-finish').click()

  await expect(page.getByTestId('kcal-target')).toHaveText('2046 kcal target')

  await page.reload()

  await expect(page.getByTestId('kcal-target')).toHaveText('2046 kcal target')
  // Header avatar shows the profile's initial (no more "Hi {name}" text link post-9B).
  await expect(page.getByTestId('avatar-link')).toHaveText('R')
})
