import { useEffect, useState } from 'react'
import { LogRepo } from '../../data/repos/LogRepo'
import { ProfileRepo } from '../../data/repos/ProfileRepo'
import { TargetRepo } from '../../data/repos/TargetRepo'
import { WeighInRepo } from '../../data/repos/WeighInRepo'
import {
  computeAdaptiveAdjustment,
  type AdaptiveRecommendation,
} from '../../domain/adaptive/adaptiveTargets'
import { groupEntriesByDate } from '../../domain/history/averages'
import { computeKcalFloor } from '../../domain/goals/goalEngine'
import { addDaysISO, todayISO } from '../../lib/date'

const DISMISSAL_KEY = 'macrodesi:adaptiveDismissedUntil'

function isDismissedThisWeek(): boolean {
  const until = localStorage.getItem(DISMISSAL_KEY)
  return until !== null && until >= todayISO()
}

function dismissForOneWeek() {
  localStorage.setItem(DISMISSAL_KEY, addDaysISO(todayISO(), 6))
}

interface Props {
  onAccepted?: () => void
}

export default function AdaptiveTargetPrompt({ onAccepted }: Props) {
  const [recommendation, setRecommendation] = useState<AdaptiveRecommendation | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isDismissedThisWeek()) return
    ;(async () => {
      const today = todayISO()
      const windowStart = addDaysISO(today, -6)

      const [profile, targets, entries, weighIns] = await Promise.all([
        new ProfileRepo().get(),
        new TargetRepo().getLatest(),
        new LogRepo().getEntriesForDateRange(windowStart, today),
        new WeighInRepo().getInRange(windowStart, today),
      ])
      if (!profile || !targets) return

      // Don't re-suggest the same week's adjustment again once it's already been accepted.
      if (targets.source === 'adaptive' && targets.effectiveDate >= windowStart) return

      const floorKcal = computeKcalFloor(profile.sex, profile.weightKg, profile.heightCm, profile.age)
      const result = computeAdaptiveAdjustment({
        loggedDays: groupEntriesByDate(entries),
        weighIns: weighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })),
        currentTargetKcal: targets.kcal,
        floorKcal,
        referenceDate: today,
      })

      if (result && result.adjustment !== 0) {
        setRecommendation(result)
      }
    })()
  }, [])

  async function handleAccept() {
    if (!recommendation) return
    setSaving(true)
    try {
      const currentTargets = await new TargetRepo().getLatest()
      const proteinG = currentTargets?.proteinG ?? 0
      const fatG = currentTargets?.fatG ?? 0
      const carbsG = Math.max(0, Math.round((recommendation.suggestedKcal - proteinG * 4 - fatG * 9) / 4))

      await new TargetRepo().add({
        effectiveDate: todayISO(),
        kcal: recommendation.suggestedKcal,
        proteinG,
        carbsG,
        fatG,
        source: 'adaptive',
      })
      setRecommendation(null)
      onAccepted?.()
    } finally {
      setSaving(false)
    }
  }

  function handleDismiss() {
    dismissForOneWeek()
    setDismissed(true)
  }

  if (!recommendation || dismissed) return null

  const direction = recommendation.adjustment > 0 ? 'increase' : 'decrease'

  return (
    <div
      className="mt-4 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm"
      data-testid="adaptive-prompt"
    >
      <p className="font-medium text-brand-700" data-testid="adaptive-headline">
        Suggestion: {direction} your target to {recommendation.suggestedKcal} kcal
      </p>
      <p className="mt-1 text-slate-600" data-testid="adaptive-reason">
        {recommendation.reason}
      </p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={handleAccept}
          className="rounded bg-brand-700 px-3 py-1 font-medium text-white disabled:opacity-50"
        >
          Accept
        </button>
        <button type="button" onClick={handleDismiss} className="rounded px-3 py-1 text-slate-500 underline">
          Dismiss
        </button>
      </div>
    </div>
  )
}
