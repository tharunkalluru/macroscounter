import { useEffect, useState } from 'react'
import { ProfileRepo } from '../../data/repos/ProfileRepo'
import { WeighInRepo } from '../../data/repos/WeighInRepo'
import { projectGoalWeight, type WeightProjection } from '../../domain/goals/weightProjection'
import { kgToLb } from '../../domain/units/weight'
import { todayISO } from '../../lib/date'
import { TargetIcon } from '../shell/icons'

interface CardState {
  projection: WeightProjection
  goalWeightKg: number
  weightUnit: 'kg' | 'lb'
}

function formatWeight(kg: number, unit: 'kg' | 'lb'): string {
  return unit === 'lb' ? `${kgToLb(kg)} lb` : `${kg} kg`
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatDuration(days: number): string {
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`
  const weeks = Math.round(days / 7)
  if (weeks < 12) return `${weeks} weeks`
  const months = Math.round(days / 30)
  return `${months} months`
}

function messageFor(state: CardState): string {
  const { projection, goalWeightKg, weightUnit } = state
  const goalText = formatWeight(goalWeightKg, weightUnit)

  switch (projection.status) {
    case 'at-goal':
      return `You're at your goal weight of ${goalText} 🎉`
    case 'plateaued':
      return `Your weight's been steady lately, so there's no clear ETA toward ${goalText} yet.`
    case 'wrong-direction':
      return `You're trending away from your goal of ${goalText} right now.`
    case 'on-track': {
      const { daysRemaining, projectedDate } = projection
      if (daysRemaining === undefined || !projectedDate) return ''
      return `At your current rate, you're on track to reach ${goalText} around ${formatDate(projectedDate)} (~${formatDuration(daysRemaining)}).`
    }
    default:
      return ''
  }
}

/** Only renders once a user has opted in with a goal weight in Settings -- invisible by default. */
export default function GoalWeightCard() {
  const [state, setState] = useState<CardState | 'no-goal' | 'insufficient-data' | null>(null)

  useEffect(() => {
    ;(async () => {
      const [profile, weighIns] = await Promise.all([new ProfileRepo().get(), new WeighInRepo().getAll()])
      if (!profile?.goalWeightKg) {
        setState('no-goal')
        return
      }
      const projection = projectGoalWeight(
        weighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })),
        profile.goalWeightKg,
        todayISO()
      )
      if (projection.status === 'insufficient-data') {
        setState('insufficient-data')
        return
      }
      setState({ projection, goalWeightKg: profile.goalWeightKg, weightUnit: profile.weightUnit ?? 'kg' })
    })()
  }, [])

  if (state === null || state === 'no-goal') return null

  if (state === 'insufficient-data') {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="goal-weight-card">
        Log a few more weigh-ins to see a projected ETA toward your goal weight.
      </p>
    )
  }

  return (
    <div
      className="flex items-start gap-3 rounded-card bg-white dark:bg-surface-dark-card p-4 shadow-card"
      data-testid="goal-weight-card"
      data-status={state.projection.status}
    >
      <TargetIcon className="mt-0.5 shrink-0 text-brand-500" />
      <p className="text-sm">{messageFor(state)}</p>
    </div>
  )
}
