import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

export default function AdaptiveTargetPrompt(_props: Props) {
  const [recommendation, setRecommendation] = useState<AdaptiveRecommendation | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [loadVersion, setLoadVersion] = useState(0)

  useEffect(() => {
    if (isDismissedThisWeek()) return
    let cancelled = false
    setLoadError(false)
    fetchAdaptiveRecommendation().then(({ recommendation, alreadyAppliedThisWeek }) => {
      if (cancelled) return
      if (recommendation && !alreadyAppliedThisWeek) setRecommendation(recommendation)
    }).catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [loadVersion])

  function handleDismiss() {
    dismissForOneWeek()
    setDismissed(true)
  }

  if (dismissed) return null
  if (loadError) return <div className="mt-4 rounded-card bg-white p-4 text-sm shadow-card dark:bg-surface-dark-card"><p role="alert">Your weekly review could not be loaded.</p><button type="button" onClick={() => setLoadVersion((version) => version + 1)} className="mt-2 min-h-touch font-medium text-brand-700 dark:text-brand-400">Try again</button></div>
  if (!recommendation) return null

  const direction = recommendation.adjustment > 0 ? 'increase' : 'decrease'

  return (
    <div
      className="mt-4 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800"
      data-testid="adaptive-prompt"
    >
      <p className="font-medium text-brand-700 dark:text-brand-400" data-testid="adaptive-headline">
        Review a possible {direction} to {recommendation.suggestedKcal} kcal
      </p>
      <p className="mt-1 text-slate-600 dark:text-slate-300" data-testid="adaptive-reason">
        {recommendation.reason}
      </p>
      <div className="mt-3 flex gap-3">
        <Link
          to="/coach/check-in"
          className="inline-flex min-h-touch items-center rounded-xl bg-brand-700 px-4 font-medium text-white"
        >
          Review this week
        </Link>
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
