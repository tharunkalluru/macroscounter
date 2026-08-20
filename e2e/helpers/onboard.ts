import { expect, type Page } from '@playwright/test'
import type { ActivityLevel, Goal, Sex } from '../../src/domain/goals/types'

interface OnboardOptions {
  name?: string
  sex?: Sex
  age?: string
  heightCm?: string
  weightKg?: string
  activityLevel?: ActivityLevel
  goal?: Goal
  /** Skip the fixed-clock setup — pass false when the test manages its own clock/routing before calling onboard. */
  fixedTime?: Date | false
}

/**
 * Drives the full onboarding wizard (Phase 11.5): one field-group per step,
 * a "Continue" tap between each. Defaults match the male/sedentary/cut
 * fixture persona used by goalEngine.test.ts unless overridden.
 */
export async function onboard(page: Page, options: OnboardOptions = {}) {
  const {
    name = 'Test Persona',
    sex = 'male',
    age = '28',
    heightCm = '170',
    weightKg = '70',
    activityLevel = 'sedentary',
    goal = 'cut',
    fixedTime = new Date('2026-08-18T02:00:00'),
  } = options

  if (fixedTime !== false) {
    await page.clock.setFixedTime(fixedTime)
  }
  await page.goto('/')
  await page.getByTestId('signin-skip-button').click()

  await page.getByPlaceholder('Your name').fill(name)
  await page.getByTestId('onboarding-continue').click()

  await page.getByRole('radio', { name: sex, exact: true }).check()
  await page.getByTestId('onboarding-continue').click()

  await page.getByPlaceholder('years').fill(age)
  await page.getByPlaceholder('cm').fill(heightCm)
  await page.getByPlaceholder('kg').fill(weightKg)
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId(`activity-${activityLevel}`).click()
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId(`goal-${goal}`).click()
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId('onboarding-finish').click()
  await expect(page).toHaveURL('/')
}
