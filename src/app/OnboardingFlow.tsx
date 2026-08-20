import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { computeGoalTargets } from '../domain/goals/goalEngine'
import { ACTIVITY_OPTIONS, GOAL_OPTIONS } from '../domain/goals/options'
import type { ActivityLevel, Goal, Sex } from '../domain/goals/types'
import { todayISO } from '../lib/date'
import SegmentedControl from './components/SegmentedControl'
import SelectableCardGroup from './components/SelectableCardGroup'
import { TEXT_INPUT_CLASS } from './components/formStyles'
import { ChevronLeftIcon } from './shell/icons'

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'male' },
  { value: 'female', label: 'female' },
]

const STEPS = ['name', 'sex', 'stats', 'activity', 'goal', 'confirm'] as const

interface Props {
  profileRepo?: ProfileRepo
  targetRepo?: TargetRepo
  onComplete?: () => void
}

export default function OnboardingFlow({ profileRepo, targetRepo, onComplete }: Props) {
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState(0)
  const step = STEPS[stepIndex]

  const [name, setName] = useState('')
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('sedentary')
  const [goal, setGoal] = useState<Goal>('cut')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const ageNum = Number(age)
  const heightNum = Number(heightCm)
  const weightNum = Number(weightKg)

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
    return computeGoalTargets({ sex, age: ageNum, heightCm: heightNum, weightKg: weightNum, activityLevel, goal })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sex, ageNum, heightNum, weightNum, activityLevel, goal])

  function validateStep(): string | null {
    if (step === 'name' && !name.trim()) return 'Please enter your name.'
    if (step === 'stats') {
      if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 100) {
        return 'Age must be between 13 and 100.'
      }
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
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
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
            style={{ transform: `scaleX(${(stepIndex + 1) / STEPS.length})` }}
            data-testid="onboarding-progress"
          />
        </div>
        <span className="text-caption tabular-nums text-slate-500 dark:text-slate-400">
          {stepIndex + 1}/{STEPS.length}
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

        {step === 'stats' && (
          <StepShell title="Tell us about yourself">
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Age</span>
                <input
                  type="number"
                  className={TEXT_INPUT_CLASS}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="years"
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Height (cm)</span>
                <input
                  type="number"
                  className={TEXT_INPUT_CLASS}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="cm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Weight (kg)</span>
                <input
                  type="number"
                  className={TEXT_INPUT_CLASS}
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="kg"
                />
              </label>
            </div>
          </StepShell>
        )}

        {step === 'activity' && (
          <StepShell title="How active are you?" subtitle="Outside of intentional exercise.">
            <SelectableCardGroup
              label="Activity level"
              options={ACTIVITY_OPTIONS}
              value={activityLevel}
              onChange={setActivityLevel}
              testIdPrefix="activity"
            />
          </StepShell>
        )}

        {step === 'goal' && (
          <StepShell title="What's your goal?">
            <SelectableCardGroup label="Goal" options={GOAL_OPTIONS} value={goal} onChange={setGoal} testIdPrefix="goal" />
          </StepShell>
        )}

        {step === 'confirm' && (
          <StepShell title="You're all set">
            {preview ? (
              <div className="flex flex-col gap-3">
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
