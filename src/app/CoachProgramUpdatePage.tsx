import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AdaptiveRecommendation } from '../domain/adaptive/adaptiveTargets'
import { acceptAdaptiveRecommendation, StaleAdaptiveRecommendationError } from '../lib/adaptive/acceptAdaptiveRecommendation'
import { fetchAdaptiveRecommendation } from '../lib/adaptive/fetchAdaptiveRecommendation'
import { useUIState } from './shell/UIStateContext'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type LoadState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'error' }
  | { status: 'ready'; recommendation: AdaptiveRecommendation; currentProteinG: number; currentFatG: number }

/**
 * The design's frame 32 — a distinct "program update" screen, reachable
 * both from the check-in wizard's last step and (per the design's own
 * annotation) independently from Strategy's "Edit program" — a real second
 * screen rather than the accept action folding straight into a confirmation
 * card on the wizard itself.
 */
export default function CoachProgramUpdatePage() {
  const navigate = useNavigate()
  const { notifyDataChanged } = useUIState()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [saving, setSaving] = useState(false)
  const [loadVersion, setLoadVersion] = useState(0)
  const [stale, setStale] = useState(false)
  const [showWork, setShowWork] = useState(false)
  const [intakeReviewed, setIntakeReviewed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    setIntakeReviewed(false)
    setError(null)
    setStale(false)
    fetchAdaptiveRecommendation().then(({ recommendation, alreadyAppliedThisWeek }) => {
      if (cancelled) return
      if (!recommendation || alreadyAppliedThisWeek) { setState({ status: 'none' }); return }
      if (!recommendation.basis) { setState({ status: 'error' }); return }
      setState({ status: 'ready', recommendation, currentProteinG: recommendation.basis.proteinG, currentFatG: recommendation.basis.fatG })
    }).catch(() => { if (!cancelled) setState({ status: 'error' }) })
    return () => { cancelled = true }
  }, [loadVersion])

  if (state.status === 'loading') {
    return <div className="mx-auto max-w-md px-6 py-8 text-sm text-slate-500 dark:text-slate-400">Loading…</div>
  }

  if (state.status === 'error') {
    return <div className="mx-auto max-w-md px-6 py-8"><h1 className="text-title">This week's plan</h1><p role="alert" className="mt-3 text-sm text-danger-700 dark:text-danger-300">Your plan could not be loaded. Try again when your diary is available.</p><button type="button" onClick={() => setLoadVersion((version) => version + 1)} className="mt-4 min-h-touch rounded-xl bg-brand-700 px-4 text-sm font-medium text-white">Try again</button></div>
  }

  if (state.status === 'none') {
    return (
      <div className="mx-auto max-w-md px-6 py-8">
        <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="program-update-none">
          Nothing to update right now - a new plan appears here once a weekly check-in has a real
          adjustment to suggest.
        </p>
        <button
          type="button"
          onClick={() => navigate('/coach')}
          className="mt-4 min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white"
        >
          Back to strategy
        </button>
      </div>
    )
  }

  const { recommendation, currentProteinG, currentFatG } = state
  const newProteinG = currentProteinG
  const newFatG = currentFatG
  const newCarbsG = Math.max(0, Math.round((recommendation.suggestedKcal - newProteinG * 4 - newFatG * 9) / 4))

  async function handleUsePlan() {
    if (savingRef.current || !intakeReviewed) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      await acceptAdaptiveRecommendation(recommendation)
      notifyDataChanged()
      navigate('/coach')
    } catch (caught) {
      const changed = caught instanceof StaleAdaptiveRecommendationError
      setStale(changed)
      setError(changed ? caught.message : 'Could not update your plan. Please try again.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-slate-500 dark:text-slate-400"
        >
          ←
        </button>
        <h1 className="text-title text-slate-900 dark:text-slate-100">This week's plan</h1>
      </div>

      <div className="overflow-hidden rounded-card shadow-card dark:shadow-card-dark" data-testid="program-update-grid">
        <table className="w-full border-collapse bg-white text-center text-xs dark:bg-surface-dark-card">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800">
              <th className="p-2 text-left text-caption text-slate-500 dark:text-slate-400"></th>
              {WEEKDAY_LABELS.map((d) => (
                <th key={d} className="p-2 font-medium text-slate-500 dark:text-slate-400">
                  {d[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'KCAL', value: recommendation.suggestedKcal, color: 'text-slate-900 dark:text-slate-100' },
              { label: 'PROT', value: newProteinG, color: 'text-brand-700 dark:text-brand-400' },
              { label: 'CARB', value: newCarbsG, color: 'text-carbs-700 dark:text-carbs-400' },
              { label: 'FAT', value: newFatG, color: 'text-fat-700 dark:text-fat-400' },
            ].map((row) => (
              <tr key={row.label} className="border-t border-slate-100 dark:border-slate-700">
                <td className="p-2 text-left text-caption font-semibold text-slate-500 dark:text-slate-400">{row.label}</td>
                {WEEKDAY_LABELS.map((d) => (
                  <td key={d} className={`p-2 tabular-nums ${row.color}`}>
                    {row.value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-slate-100 rounded-card bg-white px-4 shadow-card dark:divide-slate-700 dark:bg-surface-dark-card">
        <MovedRow label="Daily calories" from={recommendation.currentKcal} to={recommendation.suggestedKcal} suffix=" kcal" />
        <MovedRow
          label="Estimated expenditure"
          from={Math.round(recommendation.meanLoggedKcal)}
          to={Math.round(recommendation.impliedTDEE)}
          suffix=" kcal"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowWork((v) => !v)}
        data-testid="program-update-show-work"
        className="mt-4 min-h-touch w-full rounded-card border border-slate-200 px-4 py-2.5 text-left text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
      >
        {showWork ? 'Hide the calculation' : 'See the full calculation'}
      </button>
      {showWork && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400" data-testid="program-update-reason">
          {recommendation.reason}
        </p>
      )}

      <label className="mt-6 flex items-start gap-3 rounded-card bg-white p-4 text-sm shadow-card dark:bg-surface-dark-card"><input type="checkbox" checked={intakeReviewed} onChange={(event) => setIntakeReviewed(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-brand-600" /><span>I reviewed my diary for missing meals. I understand this is an estimate based on logged intake and weight changes.</span></label>
      {stale && <button type="button" onClick={() => setLoadVersion((version) => version + 1)} className="mt-4 min-h-touch rounded-xl border border-brand-600 px-4 text-sm font-medium text-brand-700 dark:text-brand-400">Reload plan</button>}
      {error && <p role="alert" className="mt-3 text-sm text-danger-700 dark:text-danger-300">{error}</p>}
      <div className="mt-auto flex gap-3 pt-6">
        <button
          type="button"
          onClick={() => navigate('/coach/check-in')}
          data-testid="program-update-adjust"
          className="min-h-touch flex-1 rounded-card border border-slate-300 px-4 py-3 font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
        >
          Adjust
        </button>
        <button
          type="button"
          onClick={handleUsePlan}
          disabled={saving || !intakeReviewed || stale}
          data-testid="program-update-use-plan"
          className="min-h-touch flex-1 rounded-card bg-brand-700 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Use this plan'}
        </button>
      </div>
    </div>
  )
}

function MovedRow({ label, from, to, suffix }: { label: string; from: number; to: number; suffix: string }) {
  if (from === to) return null
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <span className="tabular-nums text-slate-900 dark:text-slate-100">
        {from}
        {suffix} → <strong>{to}{suffix}</strong>
      </span>
    </div>
  )
}
