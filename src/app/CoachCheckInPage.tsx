import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AdaptiveRecommendation } from '../domain/adaptive/adaptiveTargets'
import { computeWeeklyFocusTip } from '../domain/adaptive/weeklyFocusTip'
import { LogRepo } from '../data/repos/LogRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { groupEntriesByDate } from '../domain/history/averages'
import { addDaysISO, todayISO } from '../lib/date'
import { fetchAdaptiveRecommendation } from '../lib/adaptive/fetchAdaptiveRecommendation'
import { CoachMessage, CoachQuickReply } from './components/CoachBubble'
import PageHeader from './components/PageHeader'
import { ArrowLeftIcon } from './shell/icons'

const STEPS = ['intro', 'your-week', 'the-math', 'new-target'] as const
type Step = (typeof STEPS)[number]

type LoadState =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'ready'; recommendation: AdaptiveRecommendation; focusTip: string | null }

export default function CoachCheckInPage() {
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    ;(async () => {
      const { recommendation } = await fetchAdaptiveRecommendation()
      if (!recommendation) {
        setState({ status: 'none' })
        return
      }

      const today = todayISO()
      const [entries, targets] = await Promise.all([
        new LogRepo().getEntriesForDateRange(addDaysISO(today, -6), today),
        new TargetRepo().getLatest(),
      ])
      const proteinTarget = targets?.proteinG ?? 0
      const proteinByDate = new Map(groupEntriesByDate(entries).map((d) => [d.date, d.p]))
      const focusTip =
        proteinTarget > 0
          ? computeWeeklyFocusTip(
              Array.from({ length: 7 }, (_, i) => {
                const date = addDaysISO(today, -6 + i)
                const [y, m, d] = date.split('-').map(Number)
                const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7
                return { weekday, hitRate: Math.min(1, (proteinByDate.get(date) ?? 0) / proteinTarget) }
              })
            )
          : null

      setState({ status: 'ready', recommendation, focusTip })
    })()
  }, [])

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
          Nothing to check in on yet - log a full week (7 days) with at least 2 weigh-ins to unlock your
          next check-in.
        </p>
      </div>
    )
  }

  const { recommendation, focusTip } = state
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
            <ArrowLeftIcon />
          </button>
        ) : (
          <Link
            to="/coach"
            aria-label="Leave check-in"
            className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-slate-500 dark:text-slate-400"
          >
            <ArrowLeftIcon />
          </Link>
        )}
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full origin-left rounded-full bg-brand-600 transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${(stepIndex + 1) / STEPS.length})` }}
          />
        </div>
        <span className="text-caption tabular-nums text-slate-500 dark:text-slate-400">
          Step {stepIndex + 1}/{STEPS.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3 py-8" data-testid={`checkin-step-${step}`}>
        {step === 'intro' && (
          <CoachMessage>
            Let's check in on your week. I'll walk through your last 7 days of logs and weigh-ins, show you
            the math, and suggest a target adjustment if one's worth making.
          </CoachMessage>
        )}

        {step === 'your-week' && (
          <>
            <CoachMessage testId="checkin-your-week-message">
              <p className="mb-2 text-caption uppercase tracking-widest text-brand-600 dark:text-brand-400">
                Your week, measured
              </p>
              <p className="mb-1">
                Average logged intake:{' '}
                <strong className="tabular-nums" data-testid="checkin-avg-kcal">
                  {Math.round(recommendation.meanLoggedKcal)} kcal
                </strong>
              </p>
              <p>
                Weight change:{' '}
                <strong className="tabular-nums" data-testid="checkin-weight-change">
                  {recommendation.weeklyWeightChangeKg > 0 ? '+' : ''}
                  {recommendation.weeklyWeightChangeKg} kg
                </strong>
              </p>
            </CoachMessage>
            <div className="flex justify-end">
              <CoachQuickReply onClick={handleContinue} testId="checkin-continue">
                Show me the numbers
              </CoachQuickReply>
            </div>
          </>
        )}

        {step === 'the-math' && (
          <>
            <CoachMessage testId="checkin-math-message">
              <p className="mb-1">
                Measured TDEE:{' '}
                <strong className="tabular-nums">{Math.round(recommendation.impliedTDEE)} kcal</strong>
              </p>
              <p className="mb-1">
                Current target: <strong className="tabular-nums">{recommendation.currentKcal} kcal</strong>
              </p>
              <p>
                Adjustment:{' '}
                <strong className="tabular-nums" data-testid="checkin-adjustment">
                  {recommendation.adjustment > 0 ? '+' : ''}
                  {recommendation.adjustment} kcal
                </strong>
              </p>
            </CoachMessage>
            <CoachMessage testId="checkin-reason">{recommendation.reason}</CoachMessage>
            <div className="flex justify-end">
              <CoachQuickReply onClick={handleContinue} testId="checkin-continue">
                So what changes?
              </CoachQuickReply>
            </div>
          </>
        )}

        {step === 'new-target' && (
          <>
            <CoachMessage testId="checkin-new-target-message">
              <p className="mb-2 text-caption uppercase tracking-widest text-brand-600 dark:text-brand-400">
                New daily target
              </p>
              <p
                className="text-display font-semibold tabular-nums text-brand-700 dark:text-brand-400"
                data-testid="checkin-suggested-kcal"
              >
                {recommendation.suggestedKcal} kcal
              </p>
            </CoachMessage>
            {focusTip && <CoachMessage testId="checkin-focus-tip">{focusTip}</CoachMessage>}
          </>
        )}
      </div>

      {step === 'new-target' && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => navigate('/coach/check-in/plan')}
            data-testid="checkin-accept"
            className="min-h-touch w-full rounded-card bg-brand-700 px-4 py-3 font-medium text-white transition-transform active:scale-[0.98]"
          >
            {direction === 'increase' ? 'Raise' : 'Lower'} for this week
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
      )}
      {step === 'intro' && (
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
