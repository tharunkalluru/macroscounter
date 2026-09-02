import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { WeighInRepo } from '../data/repos/WeighInRepo'
import { fetchAdaptiveRecommendation } from '../lib/adaptive/fetchAdaptiveRecommendation'
import { DIET_STYLE_OPTIONS } from '../domain/goals/onboardingOptions'
import { deriveCurrentProgram, type CurrentProgram } from '../domain/programs/program'
import { projectGoalWeight } from '../domain/goals/weightProjection'
import { kgToLb } from '../domain/units/weight'
import { todayISO } from '../lib/date'
import { CoachIcon } from './shell/icons'

interface GoalSection {
  startLb: number
  nowLb: number
  targetLb: number
  pct: number
  projectedDate: string | null
}

interface Loaded {
  program: CurrentProgram | null
  dietStyleLabel: string | null
  budgetKcal: number | null
  proteinG: number | null
  checkInDue: boolean
  goal: GoalSection | null
}

export default function CoachPage() {
  const [state, setState] = useState<Loaded | null>(null)

  useEffect(() => {
    ;(async () => {
      const [profile, targets, weighIns, adaptive] = await Promise.all([
        new ProfileRepo().get(),
        new TargetRepo().getAll(),
        new WeighInRepo().getAll(),
        fetchAdaptiveRecommendation(),
      ])

      const program = deriveCurrentProgram(targets, todayISO())
      const dietStyleLabel = profile?.dietStyle
        ? (DIET_STYLE_OPTIONS.find((o) => o.value === profile.dietStyle)?.label ?? null)
        : null
      const latestTarget = targets[targets.length - 1]

      let goal: GoalSection | null = null
      if (profile?.goalWeightKg && weighIns.length > 0) {
        const points = weighIns.map((w) => ({ date: w.date, weightKg: w.weightKg }))
        const projection = projectGoalWeight(points, profile.goalWeightKg, todayISO())
        const startLb = kgToLb(points[0].weightKg)
        const nowLb = kgToLb(points[points.length - 1].weightKg)
        const targetLb = kgToLb(profile.goalWeightKg)
        const totalPlanned = Math.abs(startLb - targetLb) || 1
        const madeSoFar = Math.abs(startLb - nowLb)
        goal = {
          startLb,
          nowLb,
          targetLb,
          pct: Math.min(100, Math.round((madeSoFar / totalPlanned) * 100)),
          projectedDate: projection.status === 'on-track' ? (projection.projectedDate ?? null) : null,
        }
      }

      setState({
        program,
        dietStyleLabel,
        budgetKcal: latestTarget?.kcal ?? null,
        proteinG: latestTarget?.proteinG ?? null,
        checkInDue: adaptive.recommendation !== null && !adaptive.alreadyAppliedThisWeek,
        goal,
      })
    })()
  }, [])

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-title text-slate-900 dark:text-slate-100">Strategy</h1>
      </div>
      <div className="hr-fade mb-4" />

      <Link
        to="/coach/check-in"
        data-testid="start-check-in"
        className={`flex min-h-touch items-center gap-3 rounded-card p-4 transition-transform active:scale-[0.98] ${
          state?.checkInDue
            ? 'border border-brand-600 bg-brand-50 shadow-card dark:border-brand-400 dark:bg-slate-800'
            : 'bg-white shadow-card dark:bg-surface-dark-card'
        }`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-slate-800 dark:text-brand-400">
          <CoachIcon active className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900 dark:text-slate-100">
            {state?.checkInDue ? 'Check-in due' : 'Weekly check-in'}
          </span>
          <span className="block text-caption text-slate-500 dark:text-slate-400">
            {state?.checkInDue
              ? 'This week is complete — four questions and your targets update.'
              : 'Compare your logged intake against your actual weight trend.'}
          </span>
        </span>
      </Link>

      {state?.program && (
        <div className="mt-4 rounded-card bg-white p-4 shadow-card dark:bg-surface-dark-card" data-testid="strategy-card">
          <div className="flex items-center justify-between">
            <p className="text-caption uppercase tracking-widest text-slate-500 dark:text-slate-400">Current program</p>
            <span className="text-caption font-medium tabular-nums" data-testid="strategy-week">
              Week {state.program.weekNumber}
            </span>
          </div>
          {state.dietStyleLabel && (
            <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{state.dietStyleLabel}</p>
          )}
          {(state.budgetKcal !== null || state.proteinG !== null) && (
            <div className="mt-3 flex gap-4">
              {state.budgetKcal !== null && (
                <div>
                  <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{state.budgetKcal}</p>
                  <p className="text-caption text-slate-500 dark:text-slate-400">kcal budget</p>
                </div>
              )}
              {state.proteinG !== null && (
                <div>
                  <p className="font-semibold tabular-nums text-brand-700 dark:text-brand-400">{state.proteinG}g</p>
                  <p className="text-caption text-slate-500 dark:text-slate-400">protein</p>
                </div>
              )}
            </div>
          )}
          {state.program.pastProgramsCount > 0 && (
            <p className="mt-2 text-caption text-slate-500 dark:text-slate-400" data-testid="strategy-past-programs">
              Past programs: {state.program.pastProgramsCount}
            </p>
          )}
          <Link
            to="/settings"
            data-testid="strategy-edit-program"
            className="mt-3 inline-block min-h-touch text-caption font-medium text-brand-700 underline dark:text-brand-400"
          >
            Edit program
          </Link>
        </div>
      )}

      {state?.goal && (
        <div className="mt-4 rounded-card bg-white p-4 shadow-card dark:bg-surface-dark-card" data-testid="strategy-goal-section">
          <p className="mb-3 text-caption uppercase tracking-widest text-slate-500 dark:text-slate-400">Goal</p>
          <div className="mb-2 flex justify-between text-sm">
            <span>
              <span className="block text-caption text-slate-500 dark:text-slate-400">START</span>
              <span className="tabular-nums">{state.goal.startLb} lb</span>
            </span>
            <span className="text-center">
              <span className="block text-caption text-slate-500 dark:text-slate-400">NOW</span>
              <span className="font-semibold tabular-nums text-brand-700 dark:text-brand-400">{state.goal.nowLb} lb</span>
            </span>
            <span className="text-right">
              <span className="block text-caption text-slate-500 dark:text-slate-400">TARGET</span>
              <span className="tabular-nums">{state.goal.targetLb} lb</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${state.goal.pct}%` }} />
          </div>
          <p className="mt-2 text-caption text-slate-500 dark:text-slate-400">
            {state.goal.pct}% there{state.goal.projectedDate ? ` · goal date ${state.goal.projectedDate}` : ''}
          </p>
        </div>
      )}
    </div>
  )
}
