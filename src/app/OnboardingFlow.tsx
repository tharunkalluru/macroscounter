import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import {
  DAILY_MOVEMENT_OPTIONS,
  EXERCISE_FREQUENCY_OPTIONS,
  JOB_ACTIVITY_OPTIONS,
  resolveActivityLevel,
  type DailyMovement,
  type ExerciseFrequency,
  type JobActivity,
} from '../domain/goals/activityQuiz'
import { ageFromDateOfBirth } from '../domain/goals/dateOfBirth'
import { computeGoalTargets } from '../domain/goals/goalEngine'
import { GOAL_OPTIONS } from '../domain/goals/options'
import {
  BODY_FAT_OPTIONS,
  CALORIE_FLOOR_OPTIONS,
  DIET_STYLE_OPTIONS,
  PROTEIN_PRIORITY_OPTIONS,
  WEIGHT_HISTORY_OPTIONS,
  type CalorieFloorChoice,
  type DietStyle,
  type ProteinPriority,
  type WeightHistoryClass,
} from '../domain/goals/onboardingOptions'
import type { Goal, Sex } from '../domain/goals/types'
import { todayISO } from '../lib/date'
import GoalRateSlider from './components/GoalRateSlider'
import HeightInput, { type HeightUnit } from './components/HeightInput'
import SegmentedControl from './components/SegmentedControl'
import SelectableCardGroup from './components/SelectableCardGroup'
import { TEXT_INPUT_CLASS } from './components/formStyles'
import WeightInput, { type WeightUnit } from './components/WeightInput'
import { ChevronLeftIcon } from './shell/icons'

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'male' },
  { value: 'female', label: 'female' },
]

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const STEPS_BEFORE_RATE = [
  'name',
  'sex',
  'dob',
  'stats',
  'weight-history',
  'body-fat',
  'activity-job',
  'activity-exercise',
  'activity-movement',
  'goal',
] as const
const STEPS_AFTER_RATE = ['diet-style', 'coach-reveal', 'confirm'] as const

type StepId = (typeof STEPS_BEFORE_RATE)[number] | 'goal-rate' | (typeof STEPS_AFTER_RATE)[number]

interface Props {
  profileRepo?: ProfileRepo
  targetRepo?: TargetRepo
  onComplete?: () => void
}

export default function OnboardingFlow({ profileRepo, targetRepo, onComplete }: Props) {
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)

  const [name, setName] = useState('')
  const [sex, setSex] = useState<Sex>('male')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm')
  const [weightKg, setWeightKg] = useState('')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg')
  const [weightHistoryClass, setWeightHistoryClass] = useState<WeightHistoryClass>('first_time')
  const [bodyFatPercent, setBodyFatPercent] = useState('')
  const [job, setJob] = useState<JobActivity>('desk')
  const [exercise, setExercise] = useState<ExerciseFrequency>('none')
  const [movement, setMovement] = useState<DailyMovement>('low')
  const [goal, setGoal] = useState<Goal>('cut')
  const [goalRateLbPerWeek, setGoalRateLbPerWeek] = useState(1)
  const [dietStyle, setDietStyle] = useState<DietStyle>('balanced')
  const [proteinPriority, setProteinPriority] = useState<ProteinPriority>('standard')
  const [calorieFloorChoice, setCalorieFloorChoice] = useState<CalorieFloorChoice>('standard')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const steps: StepId[] = useMemo(() => {
    const s: StepId[] = [...STEPS_BEFORE_RATE]
    if (goal !== 'maintain') s.push('goal-rate')
    s.push(...STEPS_AFTER_RATE)
    return s
  }, [goal])
  const step = steps[stepIndex]

  // The rate default matches the fixed constant it replaces exactly (1
  // lb/week = 500 kcal/day cut deficit; 0.6 lb/week = 300 kcal/day gain
  // surplus) so an untouched slider reproduces pre-R.2 behavior.
  useEffect(() => {
    setGoalRateLbPerWeek(goal === 'gain' ? 0.6 : 1)
  }, [goal])

  const activityLevel = useMemo(() => resolveActivityLevel(job, exercise, movement), [job, exercise, movement])

  const ageNum = dateOfBirth ? ageFromDateOfBirth(dateOfBirth, todayISO()) : NaN
  const heightNum = Number(heightCm)
  const weightNum = Number(weightKg)

  const fatGPerKg = DIET_STYLE_OPTIONS.find((o) => o.value === dietStyle)?.fatGPerKg
  const proteinGPerKg = PROTEIN_PRIORITY_OPTIONS.find((o) => o.value === proteinPriority)?.proteinGPerKg
  const floorBufferKcal = CALORIE_FLOOR_OPTIONS.find((o) => o.value === calorieFloorChoice)?.floorBufferKcal

  const preview = useMemo(() => {
    if (
      !Number.isFinite(ageNum) ||
      ageNum < 13 ||
      ageNum > 100 ||
      !Number.isFinite(heightNum) ||
      heightNum < 100 ||
      heightNum > 250 ||
      !Number.isFinite(weightNum) ||
      weightNum < 30 ||
      weightNum > 300
    ) {
      return null
    }
    return computeGoalTargets({
      sex,
      age: ageNum,
      heightCm: heightNum,
      weightKg: weightNum,
      activityLevel,
      goal,
      proteinGPerKg,
      fatGPerKg,
      floorBufferKcal,
      goalRateLbPerWeek: goal === 'maintain' ? undefined : goalRateLbPerWeek,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sex, ageNum, heightNum, weightNum, activityLevel, goal, proteinGPerKg, fatGPerKg, floorBufferKcal, goalRateLbPerWeek])

  function validateStep(): string | null {
    if (step === 'name' && !name.trim()) return 'Please enter your name.'
    if (step === 'dob') {
      if (!dateOfBirth) return 'Please enter your date of birth.'
      const computedAge = ageFromDateOfBirth(dateOfBirth, todayISO())
      if (computedAge < 13 || computedAge > 100) return 'Age must be between 13 and 100.'
    }
    if (step === 'stats') {
      if (!Number.isFinite(heightNum) || heightNum < 100 || heightNum > 250) {
        return 'Height must be between 100 and 250 cm.'
      }
      if (!Number.isFinite(weightNum) || weightNum < 30 || weightNum > 300) {
        return 'Weight must be between 30 and 300 kg.'
      }
    }
    return null
  }

  function handleContinue() {
    const validationError = validateStep()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setStepIndex((i) => Math.min(i + 1, steps.length - 1))
  }

  function handleBack() {
    setError(null)
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  async function handleFinish() {
    if (!preview) return
    setSubmitting(true)
    try {
      const profiles = profileRepo ?? new ProfileRepo()
      const targets = targetRepo ?? new TargetRepo()

      await profiles.save({
        name: name.trim(),
        sex,
        age: ageNum,
        heightCm: heightNum,
        weightKg: weightNum,
        activityLevel,
        goal,
        heightUnit,
        weightUnit,
        dateOfBirth,
        bodyFatPercent: bodyFatPercent ? Number(bodyFatPercent) : undefined,
        weightHistoryClass,
        dietStyle,
        proteinPriority,
        calorieFloorChoice,
        goalRateLbPerWeek: goal === 'maintain' ? undefined : goalRateLbPerWeek,
      })
      await targets.add({
        effectiveDate: todayISO(),
        kcal: preview.kcal,
        proteinG: preview.proteinG,
        carbsG: preview.carbsG,
        fatG: preview.fatG,
        source: 'computed',
      })

      onComplete?.()
      navigate('/')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
      <div className="flex items-center gap-2">
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            data-testid="onboarding-back"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ChevronLeftIcon />
          </button>
        ) : (
          <div className="min-h-touch min-w-touch" aria-hidden="true" />
        )}
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full origin-left rounded-full bg-brand-600 transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${(stepIndex + 1) / steps.length})` }}
            data-testid="onboarding-progress"
          />
        </div>
        <span className="text-caption tabular-nums text-slate-500 dark:text-slate-400">
          {stepIndex + 1}/{steps.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-center py-8" data-testid={`onboarding-step-${step}`}>
        {step === 'name' && (
          <StepShell title="What should we call you?">
            <input
              className={TEXT_INPUT_CLASS}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoFocus
            />
          </StepShell>
        )}

        {step === 'sex' && (
          <StepShell title="What's your sex?" subtitle="Used to estimate your calorie needs accurately.">
            <SegmentedControl label="Sex" options={SEX_OPTIONS} value={sex} onChange={setSex} testIdPrefix="sex" />
          </StepShell>
        )}

        {step === 'dob' && (
          <StepShell title="When were you born?">
            <input
              type="date"
              className={TEXT_INPUT_CLASS}
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              max={todayISO()}
              data-testid="dob-input"
              autoFocus
            />
          </StepShell>
        )}

        {step === 'stats' && (
          <StepShell title="Your height and weight">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Height</span>
                <HeightInput
                  valueCm={heightCm}
                  onChangeCm={setHeightCm}
                  unit={heightUnit}
                  onUnitChange={setHeightUnit}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Weight</span>
                <WeightInput
                  valueKg={weightKg}
                  onChangeKg={setWeightKg}
                  unit={weightUnit}
                  onUnitChange={setWeightUnit}
                />
              </div>
            </div>
          </StepShell>
        )}

        {step === 'weight-history' && (
          <StepShell title="Have you tried tracking before?">
            <SelectableCardGroup
              label="Tracking history"
              options={WEIGHT_HISTORY_OPTIONS}
              value={weightHistoryClass}
              onChange={setWeightHistoryClass}
              testIdPrefix="weight-history"
            />
          </StepShell>
        )}

        {step === 'body-fat' && (
          <StepShell title="What's your body composition?" subtitle="Optional — skip if you're not sure.">
            <SelectableCardGroup
              label="Body fat"
              options={BODY_FAT_OPTIONS}
              value={bodyFatPercent}
              onChange={setBodyFatPercent}
              testIdPrefix="body-fat"
            />
          </StepShell>
        )}

        {step === 'activity-job' && (
          <StepShell title="What's your day job like?">
            <SelectableCardGroup
              label="Job activity"
              options={JOB_ACTIVITY_OPTIONS}
              value={job}
              onChange={setJob}
              testIdPrefix="activity-job"
            />
          </StepShell>
        )}

        {step === 'activity-exercise' && (
          <StepShell title="How often do you exercise?">
            <SelectableCardGroup
              label="Exercise frequency"
              options={EXERCISE_FREQUENCY_OPTIONS}
              value={exercise}
              onChange={setExercise}
              testIdPrefix="activity-exercise"
            />
          </StepShell>
        )}

        {step === 'activity-movement' && (
          <StepShell title="How much do you move day-to-day?" subtitle="Outside of dedicated exercise.">
            <SelectableCardGroup
              label="Daily movement"
              options={DAILY_MOVEMENT_OPTIONS}
              value={movement}
              onChange={setMovement}
              testIdPrefix="activity-movement"
            />
          </StepShell>
        )}

        {step === 'goal' && (
          <StepShell title="What's your goal?">
            <SelectableCardGroup label="Goal" options={GOAL_OPTIONS} value={goal} onChange={setGoal} testIdPrefix="goal" />
          </StepShell>
        )}

        {step === 'goal-rate' && (
          <StepShell title={goal === 'cut' ? 'How fast do you want to lose?' : 'How fast do you want to gain?'}>
            <GoalRateSlider
              direction={goal === 'gain' ? 'gain' : 'cut'}
              valueLbPerWeek={goalRateLbPerWeek}
              onChange={setGoalRateLbPerWeek}
            />
          </StepShell>
        )}

        {step === 'diet-style' && (
          <StepShell title="Personalize your plan">
            <div className="flex flex-col gap-6">
              <SelectableCardGroup
                label="Diet style"
                options={DIET_STYLE_OPTIONS}
                value={dietStyle}
                onChange={setDietStyle}
                testIdPrefix="diet-style"
              />
              <SelectableCardGroup
                label="Protein priority"
                options={PROTEIN_PRIORITY_OPTIONS}
                value={proteinPriority}
                onChange={setProteinPriority}
                testIdPrefix="protein-priority"
              />
              <SelectableCardGroup
                label="Calorie floor"
                options={CALORIE_FLOOR_OPTIONS}
                value={calorieFloorChoice}
                onChange={setCalorieFloorChoice}
                testIdPrefix="calorie-floor"
              />
            </div>
          </StepShell>
        )}

        {step === 'coach-reveal' && (
          <StepShell title="Here's the math" subtitle="No guesswork — just your numbers.">
            {preview ? (
              <dl className="flex flex-col gap-3">
                <BreakdownRow label="Base metabolic rate" value={`${Math.round(preview.bmr)} kcal`} testId="coach-reveal-bmr" />
                <BreakdownRow
                  label="Total daily energy (activity-adjusted)"
                  value={`${Math.round(preview.tdee)} kcal`}
                  testId="coach-reveal-tdee"
                />
                <BreakdownRow label="Your daily target" value={`${preview.kcal} kcal`} testId="coach-reveal-target" highlight />
              </dl>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Go back and double-check your details to see your numbers.
              </p>
            )}
          </StepShell>
        )}

        {step === 'confirm' && (
          <StepShell title="You're all set">
            {preview ? (
              <div className="flex flex-col gap-4">
                <div className="rounded-card bg-brand-50 p-4 text-center dark:bg-slate-800">
                  <p className="text-caption text-slate-500 dark:text-slate-400">Daily calorie target</p>
                  <p className="text-display tabular-nums text-brand-700 dark:text-brand-400" data-testid="onboarding-preview-kcal">
                    {preview.kcal} kcal
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-card bg-white p-3 shadow-card dark:bg-surface-dark-card">
                    <dt className="text-caption text-slate-500 dark:text-slate-400">Protein</dt>
                    <dd className="font-semibold tabular-nums">{preview.proteinG}g</dd>
                  </div>
                  <div className="rounded-card bg-white p-3 shadow-card dark:bg-surface-dark-card">
                    <dt className="text-caption text-slate-500 dark:text-slate-400">Carbs</dt>
                    <dd className="font-semibold tabular-nums">{preview.carbsG}g</dd>
                  </div>
                  <div className="rounded-card bg-white p-3 shadow-card dark:bg-surface-dark-card">
                    <dt className="text-caption text-slate-500 dark:text-slate-400">Fat</dt>
                    <dd className="font-semibold tabular-nums">{preview.fatG}g</dd>
                  </div>
                </dl>
                <div className="rounded-card bg-white p-3 shadow-card dark:bg-surface-dark-card">
                  <p className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">Your first week</p>
                  <ul className="flex flex-col gap-1" data-testid="week-preview">
                    {WEEKDAY_LABELS.map((day) => (
                      <li key={day} className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                        <span>{day}</span>
                        <span className="tabular-nums">{preview.kcal} kcal</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Go back and double-check your details to see your targets.
              </p>
            )}
          </StepShell>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {step === 'confirm' ? (
        <button
          type="button"
          onClick={handleFinish}
          disabled={submitting || !preview}
          data-testid="onboarding-finish"
          className="min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? 'Setting up…' : 'Get started'}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleContinue}
          data-testid="onboarding-continue"
          className="min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98]"
        >
          Continue
        </button>
      )}
    </div>
  )
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-title text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  testId,
  highlight,
}: {
  label: string
  value: string
  testId: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-card p-3 ${
        highlight ? 'bg-brand-50 dark:bg-slate-800' : 'bg-white shadow-card dark:bg-surface-dark-card'
      }`}
    >
      <dt className={`text-sm ${highlight ? 'font-medium text-brand-700 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'}`}>
        {label}
      </dt>
      <dd
        className={`font-semibold tabular-nums ${highlight ? 'text-brand-700 dark:text-brand-400' : ''}`}
        data-testid={testId}
      >
        {value}
      </dd>
    </div>
  )
}
