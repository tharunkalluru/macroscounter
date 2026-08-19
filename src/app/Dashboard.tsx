import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import type { LogEntry, Meal, Profile, Targets } from '../data/models'
import { LogRepo } from '../data/repos/LogRepo'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { groupEntriesByDate } from '../domain/history/averages'
import { sumMacros } from '../domain/logging/portionMath'
import { computeStreak } from '../domain/streaks/streak'
import { addDaysISO, todayISO } from '../lib/date'
import AdaptiveTargetPrompt from './components/AdaptiveTargetPrompt'
import CaloriesRing from './components/CaloriesRing'
import MacroBar from './components/MacroBar'
import MealSection from './components/MealSection'

type LoadState = 'loading' | 'ready' | 'no-profile'

const MEALS: { key: Meal; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snacks', label: 'Snacks' },
  { key: 'dinner', label: 'Dinner' },
]

export default function Dashboard() {
  const [state, setState] = useState<LoadState>('loading')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [targets, setTargets] = useState<Targets | null>(null)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [streak, setStreak] = useState(0)

  const logRepo = new LogRepo()

  const loadEntries = useCallback(async () => {
    const todaysEntries = await logRepo.getEntriesForDate(todayISO())
    setEntries(todaysEntries)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const profileRepo = new ProfileRepo()
      const targetRepo = new TargetRepo()
      const p = await profileRepo.get()
      if (cancelled) return
      if (!p) {
        setState('no-profile')
        return
      }
      const t = await targetRepo.getLatest()
      const today = todayISO()
      const [todaysEntries, last30Entries] = await Promise.all([
        new LogRepo().getEntriesForDate(today),
        new LogRepo().getEntriesForDateRange(addDaysISO(today, -29), today),
      ])
      if (cancelled) return
      setProfile(p)
      setTargets(t ?? null)
      setEntries(todaysEntries)
      setStreak(computeStreak(groupEntriesByDate(last30Entries).map((d) => d.date), today))
      setState('ready')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleDelete(id: number) {
    await logRepo.deleteEntry(id)
    await loadEntries()
  }

  async function reloadTargets() {
    const t = await new TargetRepo().getLatest()
    setTargets(t ?? null)
  }

  if (state === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>
  }

  if (state === 'no-profile') {
    return <Navigate to="/onboarding" replace />
  }

  const totals = sumMacros(entries)
  const target = targets ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }

  return (
    <div className="mx-auto max-w-md px-6 py-8 pb-16">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-brand-700">MacroDesi</h1>
        <Link to="/settings" className="text-sm text-brand-700 underline">
          Hi {profile?.name}
        </Link>
      </div>
      {streak > 0 && (
        <p className="mt-1 text-xs text-slate-500" data-testid="dashboard-streak">
          {streak} day{streak === 1 ? '' : 's'} streak
        </p>
      )}

      <div className="mt-6 flex flex-col items-center rounded-xl bg-white p-6 shadow" data-testid="targets-card">
        <CaloriesRing consumedKcal={totals.kcal} targetKcal={target.kcal} />
        <p className="mt-2 text-xs text-slate-500" data-testid="kcal-target">
          {target.kcal} kcal target
        </p>

        <div className="mt-6 grid w-full grid-cols-1 gap-3">
          <MacroBar
            label="Protein"
            consumed={totals.p}
            target={target.proteinG}
            colorClass="bg-brand-700"
            testId="protein-bar"
          />
          <MacroBar
            label="Carbs"
            consumed={totals.c}
            target={target.carbsG}
            colorClass="bg-amber-500"
            testId="carbs-bar"
          />
          <MacroBar
            label="Fat"
            consumed={totals.f}
            target={target.fatG}
            colorClass="bg-sky-500"
            testId="fat-bar"
          />
        </div>
      </div>

      <AdaptiveTargetPrompt onAccepted={reloadTargets} />

      {MEALS.map(({ key, label }) => (
        <MealSection
          key={key}
          meal={key}
          label={label}
          entries={entries.filter((e) => e.meal === key)}
          onDelete={handleDelete}
        />
      ))}

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link to="/history" className="text-sm text-brand-700 underline">
          History
        </Link>
        <Link to="/weight" className="text-sm text-brand-700 underline">
          Weight
        </Link>
        <Link to="/templates" className="text-sm text-brand-700 underline">
          Templates
        </Link>
        <Link to="/report" className="text-sm text-brand-700 underline">
          Report
        </Link>
        <Link to="/export" className="text-sm text-brand-700 underline">
          Export
        </Link>
        <Link to="/recipes/new" className="text-sm text-brand-700 underline">
          + New recipe
        </Link>
      </div>
    </div>
  )
}
