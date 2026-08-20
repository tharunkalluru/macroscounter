import { useState, type FormEvent } from 'react'
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

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'male' },
  { value: 'female', label: 'female' },
]

interface Props {
  profileRepo?: ProfileRepo
  targetRepo?: TargetRepo
  onComplete?: () => void
}

export default function OnboardingFlow({ profileRepo, targetRepo, onComplete }: Props) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('sedentary')
  const [goal, setGoal] = useState<Goal>('cut')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const ageNum = Number(age)
    const heightNum = Number(heightCm)
    const weightNum = Number(weightKg)

    if (!name.trim()) return setError('Please enter your name.')
    if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 100) {
      return setError('Age must be between 13 and 100.')
    }
    if (!Number.isFinite(heightNum) || heightNum < 100 || heightNum > 250) {
      return setError('Height must be between 100 and 250 cm.')
    }
    if (!Number.isFinite(weightNum) || weightNum < 30 || weightNum > 300) {
      return setError('Weight must be between 30 and 300 kg.')
    }

    setSubmitting(true)
    try {
      const result = computeGoalTargets({
        sex,
        age: ageNum,
        heightCm: heightNum,
        weightKg: weightNum,
        activityLevel,
        goal,
      })

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
        kcal: result.kcal,
        proteinG: result.proteinG,
        carbsG: result.carbsG,
        fatG: result.fatG,
        source: 'computed',
      })

      onComplete?.()
      navigate('/')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-brand-700 dark:text-brand-400">
        Welcome to MacroDesi
      </h1>
      <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        Tell us about yourself so we can set your daily calorie and macro targets.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Name</span>
          <input
            className={TEXT_INPUT_CLASS}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </label>

        <SegmentedControl label="Sex" options={SEX_OPTIONS} value={sex} onChange={setSex} testIdPrefix="sex" />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Age</span>
          <input
            type="number"
            className={TEXT_INPUT_CLASS}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="years"
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

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Activity level</span>
          <select
            className={TEXT_INPUT_CLASS}
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
          >
            {ACTIVITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} — {opt.description}
              </option>
            ))}
          </select>
        </label>

        <SelectableCardGroup label="Goal" options={GOAL_OPTIONS} value={goal} onChange={setGoal} testIdPrefix="goal" />

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? 'Setting up…' : 'Get started'}
        </button>
      </form>
    </div>
  )
}
