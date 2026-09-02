import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProfileRepo } from '../../data/repos/ProfileRepo'
import { TargetRepo } from '../../data/repos/TargetRepo'
import { WeighInRepo } from '../../data/repos/WeighInRepo'
import { LogRepo } from '../../data/repos/LogRepo'
import { computeGoalTargets } from '../../domain/goals/goalEngine'
import { computeGoalReachedStats, type GoalReachedStats } from '../../domain/goals/goalReachedStats'
import { projectGoalWeight } from '../../domain/goals/weightProjection'
import { groupEntriesByDate } from '../../domain/history/averages'
import { hasCelebratedGoalWeight, markGoalWeightCelebrated } from '../../lib/goals/goalWeightCelebration'
import { vibrateSuccess } from '../../lib/haptics'
import { todayISO } from '../../lib/date'
import { useUIState } from '../shell/UIStateContext'

/**
 * The design's frame 33 — a full-screen takeover checked once per app open
 * (mounted unconditionally in AppShell, same pattern as InstallCoachMark),
 * replacing the old reactive toast that fired mid-weigh-in-entry. Reuses
 * the exact one-shot-per-goal-value gate the toast used, so it can never
 * double-fire for the same goal.
 */
export default function GoalReachedTakeover() {
  const navigate = useNavigate()
  const { notifyDataChanged } = useUIState()
  const [stats, setStats] = useState<GoalReachedStats | null>(null)
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      const profile = await new ProfileRepo().get()
      if (!profile?.goalWeightKg || hasCelebratedGoalWeight(profile.goalWeightKg)) return

      const weighIns = await new WeighInRepo().getAll()
      const points = weighIns.map((w) => ({ date: w.date, weightKg: w.weightKg }))
      const projection = projectGoalWeight(points, profile.goalWeightKg, todayISO())
      if (projection.status !== 'at-goal' || points.length === 0) return

      const entries = await new LogRepo().getEntriesForDateRange('2000-01-01', todayISO())
      const totalLoggedDays = groupEntriesByDate(entries).length

      markGoalWeightCelebrated(profile.goalWeightKg)
      vibrateSuccess()
      setGoalWeightKg(profile.goalWeightKg)
      setStats(
        computeGoalReachedStats({
          firstWeightKg: points[0].weightKg,
          latestWeightKg: points[points.length - 1].weightKg,
          firstWeighInDate: points[0].date,
          latestWeighInDate: points[points.length - 1].date,
          totalLoggedDays,
        })
      )
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })()
  }, [])

  if (!stats) return null

  async function handleMoveToMaintenance() {
    setBusy(true)
    try {
      const profile = await new ProfileRepo().get()
      if (!profile) return
      const targets = computeGoalTargets({
        sex: profile.sex,
        age: profile.age,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        activityLevel: profile.activityLevel,
        goal: 'maintain',
      })
      await new ProfileRepo().save({ ...profile, goal: 'maintain' })
      await new TargetRepo().add({
        effectiveDate: todayISO(),
        kcal: targets.kcal,
        proteinG: targets.proteinG,
        carbsG: targets.carbsG,
        fatG: targets.fatG,
        source: 'computed',
      })
      notifyDataChanged()
      setStats(null)
      navigate('/')
    } finally {
      setBusy(false)
    }
  }

  async function handleSetNewGoal() {
    setStats(null)
    navigate('/settings')
  }

  async function handleShare() {
    const text = `I lost ${stats?.lbLost} lb over ${stats?.weeksElapsed} weeks with Bitewise - averaging ${stats?.lbPerWeekAvg} lb/week.`
    if (navigator.share) {
      try {
        await navigator.share({ text })
      } catch {
        // user cancelled the share sheet -- nothing to do
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-surface px-6 py-10 dark:bg-surface-dark"
      role="dialog"
      aria-modal="true"
      aria-label="Goal reached"
      data-testid="goal-reached-takeover"
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-5 flex gap-2" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-carbs-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-fat-500" />
        </div>
        <p className="mb-2 text-caption uppercase tracking-widest text-slate-500 dark:text-slate-400">
          {stats.weeksElapsed} weeks · {stats.totalLoggedDays} logged days
        </p>
        <h1 className="text-display font-semibold text-slate-900 dark:text-slate-100">
          {goalWeightKg !== null && (
            <>
              {Math.round(goalWeightKg * 10) / 10} kg.
              <br />
            </>
          )}
          You&apos;re there.
        </h1>

        <div className="mt-8 flex w-full max-w-xs justify-between">
          <Stat value={`${Math.abs(stats.lbLost)} LB`} label={stats.lbLost >= 0 ? 'Lost' : 'Gained'} />
          <Stat value={`${Math.abs(stats.lbPerWeekAvg)}`} label="LB/WEEK AVG" />
          <Stat value={`${stats.daysLoggedPct}%`} label="DAYS LOGGED" />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={handleMoveToMaintenance}
          disabled={busy}
          data-testid="goal-reached-maintenance"
          className="min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          Move to maintenance
        </button>
        <button
          type="button"
          onClick={handleSetNewGoal}
          data-testid="goal-reached-new-goal"
          className="min-h-touch w-full rounded-card border border-slate-300 px-4 py-3 font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
        >
          Set a new goal
        </button>
        <button
          type="button"
          onClick={handleShare}
          data-testid="goal-reached-share"
          className="min-h-touch w-full rounded-card px-4 py-3 font-medium text-slate-500 underline dark:text-slate-400"
        >
          Share the chart
        </button>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-title font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-caption text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}
