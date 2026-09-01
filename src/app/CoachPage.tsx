import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { WeighInRepo } from '../data/repos/WeighInRepo'
import { DIET_STYLE_OPTIONS } from '../domain/goals/onboardingOptions'
import { deriveCurrentProgram, type CurrentProgram } from '../domain/programs/program'
import { projectGoalWeight } from '../domain/goals/weightProjection'
import { todayISO } from '../lib/date'
import { CoachIcon, TargetIcon } from './shell/icons'

interface Loaded {
  program: CurrentProgram | null
  dietStyleLabel: string | null
  atGoal: boolean
}

export default function CoachPage() {
  const [state, setState] = useState<Loaded | null>(null)

  useEffect(() => {
    ;(async () => {
      const [profile, targets, weighIns] = await Promise.all([
        new ProfileRepo().get(),
        new TargetRepo().getAll(),
        new WeighInRepo().getAll(),
      ])

      const program = deriveCurrentProgram(targets, todayISO())
      const dietStyleLabel = profile?.dietStyle
        ? (DIET_STYLE_OPTIONS.find((o) => o.value === profile.dietStyle)?.label ?? null)
        : null

      let atGoal = false
      if (profile?.goalWeightKg) {
        const projection = projectGoalWeight(
          weighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })),
          profile.goalWeightKg,
          todayISO()
        )
        atGoal = projection.status === 'at-goal'
      }

      setState({ program, dietStyleLabel, atGoal })
    })()
  }, [])

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <h1 className="sr-only">Coach</h1>

      {state?.atGoal && (
        <div
          className="mb-4 flex items-center gap-3 rounded-card bg-brand-50 p-4 dark:bg-slate-800"
          data-testid="coach-goal-reached"
        >
          <TargetIcon className="shrink-0 text-brand-600 dark:text-brand-400" />
          <p className="text-sm font-medium text-brand-700 dark:text-brand-400">
            You've reached your goal weight 🎉
          </p>
        </div>
      )}

      {state?.program && (
        <div className="rounded-card bg-white p-4 shadow-card dark:bg-surface-dark-card" data-testid="strategy-card">
          <div className="flex items-center justify-between">
            <p className="text-caption text-slate-500 dark:text-slate-400">Your program</p>
            <span className="text-caption font-medium tabular-nums" data-testid="strategy-week">
              Week {state.program.weekNumber}
            </span>
          </div>
          {state.dietStyleLabel && (
            <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{state.dietStyleLabel}</p>
          )}
          {state.program.pastProgramsCount > 0 && (
            <p className="mt-1 text-caption text-slate-500 dark:text-slate-400" data-testid="strategy-past-programs">
              Past programs: {state.program.pastProgramsCount}
            </p>
          )}
        </div>
      )}

      <Link
        to="/coach/check-in"
        data-testid="start-check-in"
        className="mt-4 flex min-h-touch items-center gap-3 rounded-card bg-white p-4 shadow-card transition-transform active:scale-[0.98] dark:bg-surface-dark-card"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-slate-800 dark:text-brand-400">
          <CoachIcon active className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900 dark:text-slate-100">Weekly check-in</span>
          <span className="block text-caption text-slate-500 dark:text-slate-400">
            Compare your logged intake against your actual weight trend
          </span>
        </span>
      </Link>
    </div>
  )
}
