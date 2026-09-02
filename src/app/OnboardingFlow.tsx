import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import {
  DAILY_MOVEMENT_OPTIONS,
  LIFTING_EXPERIENCE_OPTIONS,
  TRAINING_FREQUENCY_OPTIONS,
  resolveActivityLevel,
  type DailyMovement,
  type LiftingExperience,
  type TrainingFrequency,
} from '../domain/goals/activityQuiz'
import { ageFromDateOfBirth } from '../domain/goals/dateOfBirth'
import { computeGoalTargets } from '../domain/goals/goalEngine'
import { GOAL_OPTIONS } from '../domain/goals/options'
import {
  BODY_FAT_OPTIONS,
  CALORIE_FLOOR_OPTIONS,
  DIET_STYLE_OPTIONS,
  PROTEIN_PRIORITY_OPTIONS,
  RECENT_TREND_OPTIONS,
  WEIGHED_MORE_OPTIONS,
  type CalorieFloorChoice,
  type DietStyle,
  type ProteinPriority,
  type RecentWeightTrend,
  type WeighedMoreBefore,
} from '../domain/goals/onboardingOptions'
import type { Goal, Sex } from '../domain/goals/types'
import { kgToLb, lbToKg } from '../domain/units/weight'
import { addDaysISO, todayISO } from '../lib/date'
import ChoiceGrid from './components/ChoiceGrid'
import { CoachMessage, CoachQuickReply } from './components/CoachBubble'
import DateWheelPicker from './components/DateWheelPicker'
import GoalRateSlider from './components/GoalRateSlider'
import HeightInput, { type HeightUnit } from './components/HeightInput'
import SelectableCardGroup from './components/SelectableCardGroup'
import { TEXT_INPUT_CLASS } from './components/formStyles'
import WeightInput, { type WeightUnit } from './components/WeightInput'
import { ArrowLeftIcon } from './shell/icons'

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'male' },
  { value: 'female', label: 'female' },
]

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DIET_STYLE_LABELS: Record<DietStyle, string> = Object.fromEntries(
  DIET_STYLE_OPTIONS.map((o) => [o.value, o.label])
) as Record<DietStyle, string>

const STEPS_BEFORE_RATE = ['name', 'basics', 'stats', 'weight-history', 'body-fat', 'activity', 'goal'] as const
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
  const [weighedMoreBefore, setWeighedMoreBefore] = useState<WeighedMoreBefore>('not_sure')
  const [recentTrend, setRecentTrend] = useState<RecentWeightTrend>('not_sure')
  const [bodyFatPercent, setBodyFatPercent] = useState('')
  const [movement, setMovement] = useState<DailyMovement>('sedentary')
  const [training, setTraining] = useState<TrainingFrequency>('none')
  const [lifting, setLifting] = useState<LiftingExperience>('none')
  const [goal, setGoal] = useState<Goal>('cut')
  const [goalRateLbPerWeek, setGoalRateLbPerWeek] = useState(1)
  const [goalWeightLb, setGoalWeightLb] = useState<number | null>(null)
  const [dietStyle, setDietStyle] = useState<DietStyle>('balanced')
  const [proteinPriority, setProteinPriority] = useState<ProteinPriority>('moderate')
  const [calorieFloorChoice, setCalorieFloorChoice] = useState<CalorieFloorChoice>('standard')
  const [showExplain, setShowExplain] = useState(false)
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
  // surplus) so an untouched slider reproduces pre-existing behavior.
  useEffect(() => {
    setGoalRateLbPerWeek(goal === 'gain' ? 0.6 : 1)
  }, [goal])

  const activityLevel = useMemo(
    () => resolveActivityLevel(movement, training, lifting),
    [movement, training, lifting]
  )

  const ageNum = dateOfBirth ? ageFromDateOfBirth(dateOfBirth, todayISO()) : NaN
  const heightNum = Number(heightCm)
  const weightNum = Number(weightKg)

  // Defaults the target-weight slider to a direction-appropriate starting
  // point (10% below current for a cut, 5% above for a gain) the first time
  // weight is known and a rate-bearing goal is picked — untouched after that.
  useEffect(() => {
    if (goal === 'maintain' || !Number.isFinite(weightNum) || weightNum <= 0) return
    setGoalWeightLb((prev) => {
      if (prev !== null) return prev
      const factor = goal === 'cut' ? 0.9 : 1.05
      return kgToLb(weightNum * factor)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, weightNum])

  const goalWeightKg = goalWeightLb !== null ? lbToKg(goalWeightLb) : undefined

  const fatGPerKg = DIET_STYLE_OPTIONS.find((o) => o.value === dietStyle)?.fatGPerKg
  const proteinGPerKg = PROTEIN_PRIORITY_OPTIONS.find((o) => o.value === proteinPriority)?.proteinGPerKg
  const floorOption = CALORIE_FLOOR_OPTIONS.find((o) => o.value === calorieFloorChoice)

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
      floorBufferKcal: floorOption?.floorBufferKcal,
      floorKcalOverride: floorOption?.floorKcalOverride,
      goalRateLbPerWeek: goal === 'maintain' ? undefined : goalRateLbPerWeek,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sex, ageNum, heightNum, weightNum, activityLevel, goal, proteinGPerKg, fatGPerKg, floorOption, goalRateLbPerWeek])

  // A simple linear estimate for the onboarding preview only — not the
  // trend-based projection weightProjection.ts computes from real logged
  // data once someone has a history.
  const goalDateISO = useMemo(() => {
    if (goal === 'maintain' || goalWeightKg === undefined || !Number.isFinite(weightNum) || weightNum <= 0) {
      return null
    }
    const totalLb = Math.abs(kgToLb(weightNum) - kgToLb(goalWeightKg))
    if (totalLb === 0) return todayISO()
    const weeks = totalLb / goalRateLbPerWeek
    return addDaysISO(todayISO(), Math.round(weeks * 7))
  }, [goal, goalWeightKg, weightNum, goalRateLbPerWeek])

  function validateStep(): string | null {
    if (step === 'name' && !name.trim()) return 'Please enter your name.'
    if (step === 'basics') {
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
        weighedMoreBefore,
        recentWeightTrend: recentTrend,
        goalWeightKg,
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
            <ArrowLeftIcon />
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

        {step === 'basics' && (
          <StepShell title="The basics">
            <div className="flex flex-col gap-5">
              <ChoiceGrid
                legend="Sex"
                options={SEX_OPTIONS}
                value={sex}
                onChange={setSex}
                columns={2}
                testIdPrefix="sex"
              />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Date of birth</span>
                <DateWheelPicker valueISO={dateOfBirth} onChange={setDateOfBirth} maxISO={todayISO()} />
              </div>
            </div>
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
          <StepShell title="Your weight history">
            <div className="flex flex-col gap-6">
              <SelectableCardGroup
                label="Have you ever weighed more than this before?"
                options={WEIGHED_MORE_OPTIONS}
                value={weighedMoreBefore}
                onChange={setWeighedMoreBefore}
                testIdPrefix="weighed-more"
              />
              <SelectableCardGroup
                label="Last 3 months, your weight has been"
                options={RECENT_TREND_OPTIONS}
                value={recentTrend}
                onChange={setRecentTrend}
                testIdPrefix="recent-trend"
              />
            </div>
          </StepShell>
        )}

        {step === 'body-fat' && (
          <StepShell title="What's your body composition?" subtitle="Optional — skip if you're not sure.">
            <ChoiceGrid
              legend="Body fat"
              options={BODY_FAT_OPTIONS}
              value={bodyFatPercent}
              onChange={setBodyFatPercent}
              columns={3}
              testIdPrefix="body-fat"
            />
          </StepShell>
        )}

        {step === 'activity' && (
          <StepShell title="How much do you move?">
            <div className="flex flex-col gap-6">
              <ChoiceGrid
                legend="Outside the gym, you are"
                options={DAILY_MOVEMENT_OPTIONS}
                value={movement}
                onChange={setMovement}
                columns={3}
                testIdPrefix="movement"
              />
              <ChoiceGrid
                legend="Training sessions per week"
                options={TRAINING_FREQUENCY_OPTIONS}
                value={training}
                onChange={setTraining}
                columns={4}
                testIdPrefix="training"
              />
              <ChoiceGrid
                legend="Lifting experience"
                options={LIFTING_EXPERIENCE_OPTIONS}
                value={lifting}
                onChange={setLifting}
                columns={2}
                testIdPrefix="lifting"
              />
            </div>
          </StepShell>
        )}

        {step === 'goal' && (
          <StepShell title="What's your goal?">
            <SelectableCardGroup label="Goal" options={GOAL_OPTIONS} value={goal} onChange={setGoal} testIdPrefix="goal" />
          </StepShell>
        )}

        {step === 'goal-rate' && (
          <StepShell title={goal === 'cut' ? 'How fast do you want to lose?' : 'How fast do you want to gain?'}>
            <div className="flex flex-col gap-6">
              {preview && (
                <div className="grid grid-cols-2 gap-2">
                  <SummaryTile label="Daily budget" value={`${preview.kcal} kcal`} />
                  <SummaryTile label="Reach goal by" value={goalDateISO ? formatShortDate(goalDateISO) : '—'} />
                </div>
              )}
              {goalWeightLb !== null && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Target weight</span>
                    <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {goalWeightLb} lb
                    </span>
                  </div>
                  <input
                    type="range"
                    min={Math.round(kgToLb(weightNum * (goal === 'cut' ? 0.65 : 1)))}
                    max={Math.round(kgToLb(weightNum * (goal === 'cut' ? 1 : 1.35)))}
                    step={1}
                    value={goalWeightLb}
                    onChange={(e) => setGoalWeightLb(Number(e.target.value))}
                    aria-label="Target weight, lb"
                    data-testid="goal-weight-slider"
                    className="h-2 min-h-touch w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-600 dark:bg-slate-700"
                  />
                </div>
              )}
              <GoalRateSlider
                direction={goal === 'gain' ? 'gain' : 'cut'}
                valueLbPerWeek={goalRateLbPerWeek}
                onChange={setGoalRateLbPerWeek}
              />
            </div>
          </StepShell>
        )}

        {step === 'diet-style' && (
          <StepShell title="Personalize your plan">
            <div className="flex flex-col gap-6">
              <ChoiceGrid
                legend="Diet style"
                options={DIET_STYLE_OPTIONS}
                value={dietStyle}
                onChange={setDietStyle}
                columns={2}
                testIdPrefix="diet-style"
              />
              <ChoiceGrid
                legend="Protein priority"
                options={PROTEIN_PRIORITY_OPTIONS}
                value={proteinPriority}
                onChange={setProteinPriority}
                columns={4}
                testIdPrefix="protein-priority"
              />
              <SelectableCardGroup
                label="Calorie floor"
                options={CALORIE_FLOOR_OPTIONS}
                value={calorieFloorChoice}
                onChange={setCalorieFloorChoice}
                testIdPrefix="calorie-floor"
              />
              {preview && (
                <div className="rounded-card bg-white p-3 shadow-card dark:bg-surface-dark-card">
                  <p className="mb-2 text-caption uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Resulting daily targets
                  </p>
                  <dl className="grid grid-cols-4 gap-2 text-center" data-testid="diet-style-preview">
                    <div>
                      <dt className="text-caption text-slate-500 dark:text-slate-400">Protein</dt>
                      <dd className="font-semibold tabular-nums text-brand-700 dark:text-brand-400">{preview.proteinG}g</dd>
                    </div>
                    <div>
                      <dt className="text-caption text-slate-500 dark:text-slate-400">Carbs</dt>
                      <dd className="font-semibold tabular-nums text-carbs-700 dark:text-carbs-400">{preview.carbsG}g</dd>
                    </div>
                    <div>
                      <dt className="text-caption text-slate-500 dark:text-slate-400">Fat</dt>
                      <dd className="font-semibold tabular-nums text-fat-700 dark:text-fat-400">{preview.fatG}g</dd>
                    </div>
                    <div>
                      <dt className="text-caption text-slate-500 dark:text-slate-400">kcal</dt>
                      <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{preview.kcal}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </StepShell>
        )}

        {step === 'coach-reveal' && (
          <StepShell title="Here's the math" subtitle="No guesswork — just your numbers.">
            {preview ? (
              <div className="flex flex-col gap-3">
                <CoachMessage>Alright — I've got enough to estimate what you burn on an average day.</CoachMessage>
                <CoachMessage testId="coach-reveal-summary">
                  <p className="mb-2 text-caption uppercase tracking-widest text-brand-600 dark:text-brand-400">
                    Estimated daily expenditure
                  </p>
                  <p className="mb-1">
                    Base metabolic rate:{' '}
                    <strong className="tabular-nums" data-testid="coach-reveal-bmr">
                      {Math.round(preview.bmr)} kcal
                    </strong>
                  </p>
                  <p className="mb-1">
                    Total daily energy:{' '}
                    <strong className="tabular-nums" data-testid="coach-reveal-tdee">
                      {Math.round(preview.tdee)} kcal
                    </strong>
                  </p>
                  <p>
                    Your daily target:{' '}
                    <strong className="tabular-nums text-brand-700 dark:text-brand-400" data-testid="coach-reveal-target">
                      {preview.kcal} kcal
                    </strong>
                  </p>
                </CoachMessage>
                <CoachMessage>
                  Weigh in most mornings and log most meals — that's all the algorithm needs.
                </CoachMessage>
                {showExplain && (
                  <CoachMessage testId="coach-reveal-explain">
                    We start from the Mifflin-St Jeor formula for your base metabolic rate, scale it by your
                    activity level, then apply your goal rate as a deficit or surplus — never below your safety
                    floor.
                  </CoachMessage>
                )}
                <div className="flex flex-col items-end gap-2">
                  <CoachQuickReply onClick={() => setShowExplain((v) => !v)} testId="coach-reveal-explain-toggle">
                    How did you work that out?
                  </CoachQuickReply>
                </div>
              </div>
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

                <div className="overflow-hidden rounded-card shadow-card dark:shadow-card-dark" data-testid="week-preview">
                  <WeekTable preview={preview} />
                </div>

                <dl className="flex flex-col divide-y divide-slate-100 dark:divide-slate-700">
                  <SummaryRow label="Expenditure estimate" value={`${Math.round(preview.tdee)} kcal`} />
                  <SummaryRow label="Diet style" value={DIET_STYLE_LABELS[dietStyle]} />
                  <SummaryRow label="First check-in" value={formatShortDate(nextMondayISO(todayISO()))} />
                  {goalDateISO && <SummaryRow label="Goal date" value={formatShortDate(goalDateISO)} />}
                </dl>

                <button
                  type="button"
                  onClick={() => setShowExplain((v) => !v)}
                  data-testid="onboarding-explain-toggle"
                  className="min-h-touch w-full rounded-card border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  Explain how this was built
                </button>
                {showExplain && (
                  <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="onboarding-explain-text">
                    Your target comes from your base metabolic rate, adjusted for activity and your chosen goal
                    rate, then split into macros by your diet-style and protein-priority choices — never below
                    your safety floor. We'll recalculate every Monday from what actually happened.
                  </p>
                )}
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
          {submitting ? 'Setting up…' : 'Start day 1'}
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

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-white p-3 shadow-card dark:bg-surface-dark-card">
      <p className="text-caption uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</p>
      <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3">
      <dt className="text-sm text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  )
}

function WeekTable({ preview }: { preview: { kcal: number; proteinG: number; carbsG: number; fatG: number } }) {
  const todayIdx = (new Date(todayISO() + 'T00:00:00').getDay() + 6) % 7 // Mon=0..Sun=6
  const rows: { key: string; label: string; value: number; colorClass: string }[] = [
    { key: 'kcal', label: 'KCAL', value: preview.kcal, colorClass: 'text-slate-900 dark:text-slate-100' },
    { key: 'protein', label: 'PROT', value: preview.proteinG, colorClass: 'text-brand-700 dark:text-brand-400' },
    { key: 'carbs', label: 'CARB', value: preview.carbsG, colorClass: 'text-carbs-700 dark:text-carbs-400' },
    { key: 'fat', label: 'FAT', value: preview.fatG, colorClass: 'text-fat-700 dark:text-fat-400' },
  ]
  return (
    <table className="w-full border-collapse bg-white text-center text-xs dark:bg-surface-dark-card">
      <thead>
        <tr className="bg-slate-50 dark:bg-slate-800">
          <th className="p-2 text-left text-caption text-slate-500 dark:text-slate-400"></th>
          {WEEKDAY_LABELS.map((d, i) => (
            <th
              key={d}
              className={`p-2 font-medium ${i === todayIdx ? 'text-brand-700 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'}`}
            >
              {d[0]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-t border-slate-100 dark:border-slate-700">
            <td className="p-2 text-left text-caption font-semibold text-slate-500 dark:text-slate-400">{row.label}</td>
            {WEEKDAY_LABELS.map((d, i) => (
              <td
                key={d}
                className={`p-2 tabular-nums ${row.colorClass} ${i === todayIdx ? 'bg-brand-50 font-semibold dark:bg-slate-700' : ''}`}
              >
                {row.value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function nextMondayISO(fromISO: string): string {
  const [y, m, d] = fromISO.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay() // 0=Sun..6=Sat
  const daysUntilMonday = day === 1 ? 7 : ((1 - day + 7) % 7 || 7)
  return addDaysISO(fromISO, daysUntilMonday)
}
