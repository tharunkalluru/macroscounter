import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AdaptiveRecommendation } from '../domain/adaptive/adaptiveTargets'
import { acceptAdaptiveRecommendation } from '../lib/adaptive/acceptAdaptiveRecommendation'
import { fetchAdaptiveRecommendation } from '../lib/adaptive/fetchAdaptiveRecommendation'
import PageHeader from './components/PageHeader'
import { ChevronLeftIcon } from './shell/icons'

const STEPS = ['intro', 'your-week', 'the-math', 'new-target'] as const
type Step = (typeof STEPS)[number]

type LoadState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'ready'; recommendation: AdaptiveRecommendation }
  | { status: 'accepted'; recommendation: AdaptiveRecommendation }

export default function CoachCheckInPage() {
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchAdaptiveRecommendation().then(({ recommendation }) => {
      setState(recommendation ? { status: 'ready', recommendation } : { status: 'none' })
    })
  }, [])

  async function handleAccept() {
    if (state.status !== 'ready') return
    setSaving(true)
    try {
      await acceptAdaptiveRecommendation(state.recommendation)
      setState({ status: 'accepted', recommendation: state.recommendation })
    } finally {
      setSaving(false)
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="mx-auto max-w-md px-6 py-8">
        <PageHeader title="Weekly check-in" backTo="/coach" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    )
  }

  if (state.status === 'none') {
    return (
      <div className="mx-auto max-w-md px-6 py-8">
        <PageHeader title="Weekly check-in" backTo="/coach" />
        <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="checkin-none">
          Nothing to check in on yet — log a full week (7 days) with at least 2 weigh-ins to unlock your
          next check-in.
        </p>
      </div>
    )
  }

  if (state.status === 'accepted') {
    return (
      <div className="mx-auto max-w-md px-6 py-8">
        <PageHeader title="Weekly check-in" backTo="/coach" />
        <div className="rounded-card bg-brand-50 p-4 text-center dark:bg-slate-800" data-testid="checkin-accepted">
          <p className="font-medium text-brand-700 dark:text-brand-400">Your target is updated</p>
          <p className="mt-1 text-display tabular-nums text-brand-700 dark:text-brand-400">
            {state.recommendation.suggestedKcal} kcal
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/coach')}
          className="mt-4 min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    )
  }

  const { recommendation } = state
  const step: Step = STEPS[stepIndex]
  const direction = recommendation.adjustment > 0 ? 'increase' : 'decrease'

  function handleContinue() {
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }
  function handleBack() {
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
      <h1 className="sr-only">Weekly check-in</h1>
      <div className="flex items-center gap-2">
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Previous step"
            data-testid="checkin-back"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-slate-500 dark:text-slate-400"
          >
            <ChevronLeftIcon />
          </button>
        ) : (
          <Link
            to="/coach"
            aria-label="Leave check-in"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-slate-500 dark:text-slate-400"
          >
            <ChevronLeftIcon />
          </Link>
        )}
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full origin-left rounded-full bg-brand-600 transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${(stepIndex + 1) / STEPS.length})` }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center py-8" data-testid={`checkin-step-${step}`}>
        {step === 'intro' && (
          <div className="flex flex-col gap-3">
            <h1 className="text-title text-slate-900 dark:text-slate-100">Let's check in on your week</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              We'll walk through your last 7 days of logs and weigh-ins, show you the math, and suggest a
              target adjustment if one's worth making.
            </p>
          </div>
        )}

        {step === 'your-week' && (
          <div className="flex flex-col gap-3">
            <h1 className="text-title text-slate-900 dark:text-slate-100">Your week</h1>
            <div className="rounded-card bg-white p-4 shadow-card dark:bg-surface-dark-card">
              <p className="text-caption text-slate-500 dark:text-slate-400">Average logged intake</p>
              <p className="text-display tabular-nums" data-testid="checkin-avg-kcal">
                {Math.round(recommendation.meanLoggedKcal)} kcal
              </p>
            </div>
            <div className="rounded-card bg-white p-4 shadow-card dark:bg-surface-dark-card">
              <p className="text-caption text-slate-500 dark:text-slate-400">Weight change</p>
              <p className="text-display tabular-nums" data-testid="checkin-weight-change">
                {recommendation.weeklyWeightChangeKg > 0 ? '+' : ''}
                {recommendation.weeklyWeightChangeKg} kg
              </p>
            </div>
          </div>
        )}

        {step === 'the-math' && (
          <div className="flex flex-col gap-3">
            <h1 className="text-title text-slate-900 dark:text-slate-100">Here's the math</h1>
            <div className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-card dark:bg-surface-dark-card">
              <Row label="Measured TDEE" value={`${Math.round(recommendation.impliedTDEE)} kcal`} />
              <Row label="Current target" value={`${recommendation.currentKcal} kcal`} />
              <Row
                label="Adjustment"
                value={`${recommendation.adjustment > 0 ? '+' : ''}${recommendation.adjustment} kcal`}
                testId="checkin-adjustment"
              />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="checkin-reason">
              {recommendation.reason}
            </p>
          </div>
        )}

        {step === 'new-target' && (
          <div className="flex flex-col gap-3">
            <h1 className="text-title text-slate-900 dark:text-slate-100">
              {direction === 'increase' ? 'Raise' : 'Lower'} your target?
            </h1>
            <div className="rounded-card bg-brand-50 p-4 text-center dark:bg-slate-800">
              <p className="text-caption text-slate-500 dark:text-slate-400">New daily target</p>
              <p
                className="text-display tabular-nums text-brand-700 dark:text-brand-400"
                data-testid="checkin-suggested-kcal"
              >
                {recommendation.suggestedKcal} kcal
              </p>
            </div>
          </div>
        )}
      </div>

      {step === 'new-target' ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleAccept}
            data-testid="checkin-accept"
            className="min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Accept new target'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/coach')}
            data-testid="checkin-keep-current"
            className="min-h-touch w-full rounded-card px-4 py-3 font-medium text-slate-600 dark:text-slate-300"
          >
            Keep current target
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleContinue}
          data-testid="checkin-continue"
          className="min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98]"
        >
          Continue
        </button>
      )}
    </div>
  )
}

function Row({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-semibold tabular-nums" data-testid={testId}>
        {value}
      </span>
    </div>
  )
}
