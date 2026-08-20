import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { computeGoalTargets } from '../domain/goals/goalEngine'
import { ACTIVITY_OPTIONS, GOAL_OPTIONS } from '../domain/goals/options'
import type { ActivityLevel, Goal, Sex } from '../domain/goals/types'
import type { ThemePreference } from '../domain/theme/resolveTheme'
import { todayISO } from '../lib/date'
import AccountSection from './components/AccountSection'
import SegmentedControl from './components/SegmentedControl'
import SelectableCardGroup from './components/SelectableCardGroup'
import SyncStatusDot from './components/SyncStatusDot'
import { TEXT_INPUT_CLASS } from './components/formStyles'
import { useTheme } from './shell/ThemeContext'

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'male' },
  { value: 'female', label: 'female' },
]

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

function ThemeToggle() {
  const { preference, setPreference } = useTheme()
  return (
    <SegmentedControl
      label="Appearance"
      options={THEME_OPTIONS}
      value={preference}
      onChange={setPreference}
      testIdPrefix="theme-option"
    />
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('sedentary')
  const [goal, setGoal] = useState<Goal>('cut')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    ;(async () => {
      const profile = await new ProfileRepo().get()
      if (profile) {
        setName(profile.name)
        setSex(profile.sex)
        setAge(String(profile.age))
        setHeightCm(String(profile.heightCm))
        setWeightKg(String(profile.weightKg))
        setActivityLevel(profile.activityLevel)
        setGoal(profile.goal)
      }
      setLoading(false)
    })()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)

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

    const result = computeGoalTargets({
      sex,
      age: ageNum,
      heightCm: heightNum,
      weightKg: weightNum,
      activityLevel,
      goal,
    })

    await new ProfileRepo().save({
      name: name.trim(),
      sex,
      age: ageNum,
      heightCm: heightNum,
      weightKg: weightNum,
      activityLevel,
      goal,
    })
    await new TargetRepo().add({
      effectiveDate: todayISO(),
      kcal: result.kcal,
      proteinG: result.proteinG,
      carbsG: result.carbsG,
      fatG: result.fatG,
      source: 'computed',
    })

    setSaved(true)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <Link to="/" className="mb-4 inline-flex min-h-touch items-center text-sm text-brand-700 underline dark:text-brand-400">
        ← Back
      </Link>
      <h1 className="mb-2 text-2xl font-bold text-brand-700 dark:text-brand-400">
        Profile & Targets
      </h1>
      <SyncStatusDot />

      <div className="mt-4">
        <AccountSection />
      </div>

      <div className="mt-6">
        <ThemeToggle />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Name</span>
          <input className={TEXT_INPUT_CLASS} value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <SegmentedControl label="Sex" options={SEX_OPTIONS} value={sex} onChange={setSex} testIdPrefix="sex" />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Age</span>
          <input
            type="number"
            className={TEXT_INPUT_CLASS}
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Height (cm)
          </span>
          <input
            type="number"
            className={TEXT_INPUT_CLASS}
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Weight (kg)
          </span>
          <input
            type="number"
            className={TEXT_INPUT_CLASS}
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Activity level
          </span>
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
        {saved && (
          <p className="text-sm text-brand-700 dark:text-brand-400">
            Saved — targets recalculated.
          </p>
        )}

        <div className="mt-2 flex gap-3">
          <button
            type="submit"
            className="min-h-touch rounded-card bg-brand-700 px-4 py-2.5 font-medium text-white transition-transform active:scale-[0.98]"
          >
            Save & recalculate
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="min-h-touch rounded-card px-4 py-2.5 text-slate-600 transition-transform active:scale-[0.98] dark:text-slate-300"
          >
            Done
          </button>
        </div>
      </form>

      <div className="mt-8 flex flex-col gap-1 border-t border-slate-200 pt-6 dark:border-slate-700">
        <h2 className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">More</h2>
        <Link
          to="/templates"
          className="min-h-touch inline-flex items-center text-brand-700 underline dark:text-brand-400"
        >
          Meal templates
        </Link>
        <Link
          to="/export"
          className="min-h-touch inline-flex items-center text-brand-700 underline dark:text-brand-400"
        >
          Export data
        </Link>
      </div>
    </div>
  )
}
