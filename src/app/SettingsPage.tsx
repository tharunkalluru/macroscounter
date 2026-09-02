import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { computeGoalTargets } from '../domain/goals/goalEngine'
import { ACTIVITY_OPTIONS, GOAL_OPTIONS } from '../domain/goals/options'
import type { ActivityLevel, Goal, Sex } from '../domain/goals/types'
import { kgToLb, lbToKg } from '../domain/units/weight'
import { todayISO } from '../lib/date'
import { getFoodSourcePreferences } from '../lib/settings/foodSourcePreferences'
import AccountSection from './components/AccountSection'
import HeightInput, { type HeightUnit } from './components/HeightInput'
import ProfileSummaryCard from './components/ProfileSummaryCard'
import SegmentedControl from './components/SegmentedControl'
import SelectableCardGroup from './components/SelectableCardGroup'
import SettingsRow from './components/SettingsRow'
import SyncStatusDot from './components/SyncStatusDot'
import { TEXT_INPUT_CLASS } from './components/formStyles'
import WeightInput, { type WeightUnit } from './components/WeightInput'
import { ForkKnifeIcon, PaletteIcon, TrashIcon } from './shell/icons'
import { useTheme } from './shell/ThemeContext'

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'male' },
  { value: 'female', label: 'female' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [sex, setSex] = useState<Sex>('male')
  const [age, setAge] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('cm')
  const [weightKg, setWeightKg] = useState('')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('sedentary')
  const [goal, setGoal] = useState<Goal>('cut')
  const [goalWeightKgCanonical, setGoalWeightKgCanonical] = useState<number | undefined>(undefined)
  const [goalWeightInput, setGoalWeightInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [foodSources] = useState(getFoodSourcePreferences)
  const { preference: themePreference } = useTheme()
  const foodSourcesOnCount = Number(foodSources.off) + Number(foodSources.fdc)

  useEffect(() => {
    ;(async () => {
      const profile = await new ProfileRepo().get()
      if (profile) {
        setName(profile.name)
        setSex(profile.sex)
        setAge(String(profile.age))
        setHeightCm(String(profile.heightCm))
        setHeightUnit(profile.heightUnit ?? 'cm')
        setWeightKg(String(profile.weightKg))
        setWeightUnit(profile.weightUnit ?? 'kg')
        setActivityLevel(profile.activityLevel)
        setGoal(profile.goal)
        if (profile.goalWeightKg !== undefined) {
          const unit = profile.weightUnit ?? 'kg'
          setGoalWeightKgCanonical(profile.goalWeightKg)
          setGoalWeightInput(String(unit === 'lb' ? kgToLb(profile.goalWeightKg) : profile.goalWeightKg))
        }
      }
      setLoading(false)
    })()
  }, [])

  // Re-derive the displayed goal-weight text on a unit switch only (not on
  // every keystroke) -- same pattern WeightInput uses internally.
  useEffect(() => {
    if (goalWeightKgCanonical === undefined) return
    setGoalWeightInput(String(weightUnit === 'lb' ? kgToLb(goalWeightKgCanonical) : goalWeightKgCanonical))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightUnit])

  function handleGoalWeightChange(text: string) {
    setGoalWeightInput(text)
    if (text.trim() === '') {
      setGoalWeightKgCanonical(undefined)
      return
    }
    const num = Number(text)
    if (Number.isFinite(num)) {
      setGoalWeightKgCanonical(weightUnit === 'lb' ? lbToKg(num) : num)
    }
  }

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
    if (
      goalWeightKgCanonical !== undefined &&
      (!Number.isFinite(goalWeightKgCanonical) || goalWeightKgCanonical < 30 || goalWeightKgCanonical > 300)
    ) {
      return setError('Goal weight must be between 30 and 300 kg.')
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
      heightUnit,
      weightUnit,
      goalWeightKg: goalWeightKgCanonical,
    })
    await new TargetRepo().add({
      effectiveDate: todayISO(),
      kcal: result.kcal,
      proteinG: result.proteinG,
      carbsG: result.carbsG,
      fatG: result.fatG,
      fiberG: result.fiberG,
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
      <h1 className="mb-6 text-2xl font-bold text-brand-700 dark:text-brand-400">Settings</h1>

      <ProfileSummaryCard name={name} />

      <SettingsGroup title="You">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Goal weight <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
          </span>
          <input
            type="number"
            step="0.1"
            className={TEXT_INPUT_CLASS}
            value={goalWeightInput}
            onChange={(e) => handleGoalWeightChange(e.target.value)}
            placeholder={weightUnit}
            data-testid="goal-weight-input"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Set this to see a projected ETA on Trends.
          </span>
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
                {opt.label} - {opt.description}
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
            Saved - targets recalculated.
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
      </SettingsGroup>

      <SettingsGroup title="The App">
        <SettingsRow
          to="/settings/food"
          icon={ForkKnifeIcon}
          label="Food log & sources"
          valueHint={`${foodSourcesOnCount} ON`}
          testId="settings-row-food"
        />
        <SettingsRow
          to="/settings/appearance"
          icon={PaletteIcon}
          label="Appearance & export"
          valueHint={themePreference}
          testId="settings-row-appearance"
        />
      </SettingsGroup>

      <SettingsGroup title="Your Data">
        <SyncStatusDot />
        <div className="mt-4">
          <AccountSection />
        </div>

        <div className="mt-6 flex flex-col gap-1">
          <Link
            to="/templates"
            className="min-h-touch inline-flex items-center text-brand-700 underline dark:text-brand-400"
          >
            Meal templates
          </Link>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
          <button
            type="button"
            disabled
            data-testid="delete-account-button"
            className="flex min-h-touch items-center gap-2 text-sm font-medium text-danger-600 dark:text-danger-500"
            aria-disabled="true"
          >
            <TrashIcon />
            Delete account & data
          </button>
          <p className="mt-1 text-caption text-slate-500 dark:text-slate-400">Coming soon.</p>
        </div>
      </SettingsGroup>
    </div>
  )
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 border-t border-slate-200 pt-6 first:mt-0 first:border-t-0 first:pt-0 dark:border-slate-700">
      <h2 className="mb-4 text-caption font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h2>
      {children}
    </section>
  )
}
