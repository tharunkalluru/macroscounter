import { useEffect, useState } from 'react'
import { acceptAdaptiveRecommendation } from '../../lib/adaptive/acceptAdaptiveRecommendation'
import { fetchAdaptiveRecommendation } from '../../lib/adaptive/fetchAdaptiveRecommendation'
import type { AdaptiveRecommendation } from '../../domain/adaptive/adaptiveTargets'
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
    fetchAdaptiveRecommendation().then(({ recommendation, alreadyAppliedThisWeek }) => {
      if (recommendation && !alreadyAppliedThisWeek) setRecommendation(recommendation)
    })
  }, [])

  async function handleAccept() {
    if (!recommendation) return
    setSaving(true)
    try {
      await acceptAdaptiveRecommendation(recommendation)
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
      className="mt-4 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800"
      data-testid="adaptive-prompt"
    >
      <p className="font-medium text-brand-700 dark:text-brand-400" data-testid="adaptive-headline">
        Suggestion: {direction} your target to {recommendation.suggestedKcal} kcal
      </p>
      <p className="mt-1 text-slate-600 dark:text-slate-300" data-testid="adaptive-reason">
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
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded px-3 py-1 text-slate-500 underline dark:text-slate-400"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
