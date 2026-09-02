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
 * (movement, training, lifting) triples that resolve back to each
 * ActivityLevel via resolveActivityLevel (see
 * src/domain/goals/activityQuiz.ts) — kept in sync with that scoring table
 * by activityQuiz.test.ts's own coverage.
 */
const ACTIVITY_TO_QUIZ: Record<
  ActivityLevel,
  { movement: string; training: string; lifting: string }
> = {
  sedentary: { movement: 'sedentary', training: 'none', lifting: 'none' },
  light: { movement: 'moderately_active', training: 'light', lifting: 'none' },
  moderate: { movement: 'moderately_active', training: 'moderate', lifting: 'beginner' },
  active: { movement: 'very_active', training: 'moderate', lifting: 'intermediate' },
  very_active: { movement: 'very_active', training: 'frequent', lifting: 'advanced' },
}

/**
 * Drives the full onboarding wizard (Phase F.2 restructure: name, basics
 * [sex+DOB combined], stats, weight-history, body-fat, activity [one
 * combined screen], goal, goal-rate, diet-style, coach-reveal, confirm).
 * Defaults match the male/sedentary/cut fixture persona used by
 * goalEngine.test.ts unless overridden. The weight-history, body-fat, and
 * target-weight/diet-style/protein/floor questions are left at their
 * defaults, which reproduce pre-existing target math exactly — only
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

  // basics: sex + date of birth on one combined screen.
  await page.getByRole('radio', { name: sex, exact: true }).check()
  // Date of birth: Jan 1 of (current year - age) always yields exactly
  // `age` at any later date within that same year, regardless of which
  // fixed clock a given spec is using.
  const referenceYear = await page.evaluate(() => new Date().getFullYear())
  await page.getByTestId('dob-month').selectOption('1')
  await page.getByTestId('dob-day').selectOption('1')
  await page.getByTestId('dob-year').selectOption(String(referenceYear - Number(age)))
  await page.getByTestId('onboarding-continue').click()

  await page.getByPlaceholder('cm').fill(heightCm)
  await page.getByPlaceholder('kg').fill(weightKg)
  await page.getByTestId('onboarding-continue').click()

  // weight-history: leave the default selection.
  await page.getByTestId('onboarding-continue').click()

  // body-fat: skippable, leave unselected.
  await page.getByTestId('onboarding-continue').click()

  // activity: one combined screen (movement, training frequency, lifting experience).
  const quiz = ACTIVITY_TO_QUIZ[activityLevel]
  await page.getByTestId(`movement-${quiz.movement}`).click()
  await page.getByTestId(`training-${quiz.training}`).click()
  await page.getByTestId(`lifting-${quiz.lifting}`).click()
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId(`goal-${goal}`).click()
  await page.getByTestId('onboarding-continue').click()

  if (goal !== 'maintain') {
    // goal-rate/target-weight: leave the defaults (reproduces the legacy fixed deficit/surplus).
    await page.getByTestId('onboarding-continue').click()
  }

  // diet-style/protein-priority/calorie-floor: leave defaults.
  await page.getByTestId('onboarding-continue').click()

  // coach-reveal: pure presentation, nothing to fill in.
  await page.getByTestId('onboarding-continue').click()

  await page.getByTestId('onboarding-finish').click()
  await expect(page).toHaveURL('/')
}
