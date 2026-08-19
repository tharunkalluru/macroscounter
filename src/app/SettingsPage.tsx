import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { computeGoalTargets } from '../domain/goals/goalEngine'
import type { ActivityLevel, Goal, Sex } from '../domain/goals/types'
import { todayISO } from '../lib/date'

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
]

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'cut', label: 'Lose fat' },
  { value: 'maintain', label: 'Maintain weight' },
  { value: 'gain', label: 'Gain weight' },
]

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
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <Link to="/" className="mb-4 text-sm text-brand-700 underline">
        ← Back
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-brand-700">Profile & Targets</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input
            className="rounded border border-slate-300 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium">Sex</legend>
          <div className="flex gap-4">
            {(['male', 'female'] as const).map((value) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sex"
                  value={value}
                  checked={sex === value}
                  onChange={() => setSex(value)}
                />
                <span className="capitalize">{value}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Age</span>
          <input
            type="number"
            className="rounded border border-slate-300 px-3 py-2"
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Height (cm)</span>
          <input
            type="number"
            className="rounded border border-slate-300 px-3 py-2"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Weight (kg)</span>
          <input
            type="number"
            className="rounded border border-slate-300 px-3 py-2"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Activity level</span>
          <select
            className="rounded border border-slate-300 px-3 py-2"
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
          >
            {ACTIVITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium">Goal</legend>
          <div className="flex flex-col gap-2">
            {GOAL_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="goal"
                  value={opt.value}
                  checked={goal === opt.value}
                  onChange={() => setGoal(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {saved && <p className="text-sm text-brand-700">Saved — targets recalculated.</p>}

        <div className="mt-2 flex gap-3">
          <button type="submit" className="rounded bg-brand-700 px-4 py-2 font-medium text-white">
            Save & recalculate
          </button>
          <button type="button" onClick={() => navigate('/')} className="rounded px-4 py-2 text-slate-600">
            Done
          </button>
        </div>
      </form>
    </div>
  )
}
