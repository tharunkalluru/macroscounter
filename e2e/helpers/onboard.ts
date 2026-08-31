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
 * (job, exercise, movement) triples that resolve back to each ActivityLevel
 * via resolveActivityLevel (see src/domain/goals/activityQuiz.ts) — kept in
 * sync with that scoring table by activityQuiz.test.ts's own coverage.
 */
const ACTIVITY_TO_QUIZ: Record<
  ActivityLevel,
  { job: string; exercise: string; movement: string }
> = {
  sedentary: { job: 'desk', exercise: 'none', movement: 'low' },
  light: { job: 'desk', exercise: 'light', movement: 'moderate' },
  moderate: { job: 'on_feet', exercise: 'moderate', movement: 'moderate' },
  active: { job: 'on_feet', exercise: 'frequent', movement: 'high' },
  very_active: { job: 'physical', exercise: 'frequent', movement: 'high' },
}

/**
 * Drives the full onboarding wizard (Phase R.2: 14 steps). Defaults match
 * the male/sedentary/cut fixture persona used by goalEngine.test.ts unless
 * overridden. New Phase R.2 steps (weight-history, body-fat, goal-rate,
 * diet-style/protein-priority/calorie-floor, coach-reveal) are left at
 * their defaults, which reproduce pre-R.2 target math exactly — only
 * name/sex/age/height/weight/activityLevel/goal are parameterized here.
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

  // Date of birth: Jan 1 of (current year - age) always yields exactly
  // `age` at any later date within that same year, regardless of which
  // fixed clock a given spec is using.
  const referenceYear = await page.evaluate(() => new Date().getFullYear())
  await page.getByTestId('dob-input').fill(`${referenceYear - Number(age)}-01-01`)
  await page.getByTestId('onboarding-continue').click()

  await page.getByPlaceholder('cm').fill(heightCm)
  await page.getByPlaceholder('kg').fill(weightKg)
  await page.getByTestId('onboarding-continue').click()

  // weight-history: leave the default selection.
  await page.getByTestId('onboarding-continue').click()

  // body-fat: skippable, leave unselected.
  await page.getByTestId('onboarding-continue').click()

  const quiz = ACTIVITY_TO_QUIZ[activityLevel]
  await page.getByTestId(`activity-job-${quiz.job}`).click()
  await page.getByTestId('onboarding-continue').click()
  await page.getByTestId(`activity-exercise-${quiz.exercise}`).click()
  await page.getByTestId('onboarding-continue').click()
  await page.getByTestId(`activity-movement-${quiz.movement}`).click()
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId(`goal-${goal}`).click()
  await page.getByTestId('onboarding-continue').click()

  if (goal !== 'maintain') {
    // goal-rate: leave the default (reproduces the legacy fixed deficit/surplus).
    await page.getByTestId('onboarding-continue').click()
  }

  // diet-style/protein-priority/calorie-floor: leave defaults.
  await page.getByTestId('onboarding-continue').click()

  // coach-reveal: pure presentation, nothing to fill in.
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId('onboarding-finish').click()
  await expect(page).toHaveURL('/')
}
