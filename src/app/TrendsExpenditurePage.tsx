import { useEffect, useState } from 'react'
import { LogRepo } from '../data/repos/LogRepo'
import { ProfileRepo } from '../data/repos/ProfileRepo'
import { TargetRepo } from '../data/repos/TargetRepo'
import { WeighInRepo } from '../data/repos/WeighInRepo'
import { computeAdaptiveAdjustment, type AdaptiveRecommendation } from '../domain/adaptive/adaptiveTargets'
import { computeExpenditureHistory, type ExpenditureWeekPoint } from '../domain/adaptive/expenditureHistory'
import { groupEntriesByDate } from '../domain/history/averages'
import { calculateBMR, calculateTDEE, computeKcalFloor } from '../domain/goals/goalEngine'
import { addDaysISO, todayISO } from '../lib/date'
import PageHeader from './components/PageHeader'
import Sparkline from './components/Sparkline'

interface Loaded {
  measured: AdaptiveRecommendation
  formulaTDEE: number
  history: ExpenditureWeekPoint[]
}

export default function TrendsExpenditurePage() {
  const [state, setState] = useState<Loaded | 'insufficient-data' | null>(null)

  const HISTORY_WEEKS = 6

  useEffect(() => {
    ;(async () => {
      const today = todayISO()
      const windowStart = addDaysISO(today, -6)
      const historyStart = addDaysISO(today, -(HISTORY_WEEKS * 7 - 1))

      const [profile, targets, entries, weighIns, historyEntries, historyWeighIns] = await Promise.all([
        new ProfileRepo().get(),
        new TargetRepo().getLatest(),
        new LogRepo().getEntriesForDateRange(windowStart, today),
        new WeighInRepo().getInRange(windowStart, today),
        new LogRepo().getEntriesForDateRange(historyStart, today),
        new WeighInRepo().getInRange(historyStart, today),
      ])
      if (!profile || !targets) {
        setState('insufficient-data')
        return
      }

      const floorKcal = computeKcalFloor(profile.sex, profile.weightKg, profile.heightCm, profile.age)
      const measured = computeAdaptiveAdjustment({
        loggedDays: groupEntriesByDate(entries),
        weighIns: weighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })),
        currentTargetKcal: targets.kcal,
        floorKcal,
        referenceDate: today,
      })

      if (!measured) {
        setState('insufficient-data')
        return
      }

      const bmr = calculateBMR(profile.sex, profile.weightKg, profile.heightCm, profile.age)
      const formulaTDEE = Math.round(calculateTDEE(bmr, profile.activityLevel))

      const history = computeExpenditureHistory({
        loggedDays: groupEntriesByDate(historyEntries),
        weighIns: historyWeighIns.map((w) => ({ date: w.date, weightKg: w.weightKg })),
        referenceDate: today,
        weeks: HISTORY_WEEKS,
      })

      setState({ measured, formulaTDEE, history })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <PageHeader title="Expenditure" backTo="/trends" />
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Measured from your last 7 days of logs and weigh-ins - not a formula.
      </p>

      {state === null && <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

      {state === 'insufficient-data' && (
        <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="expenditure-insufficient-data">
          Log 7 days in a row and at least 2 weigh-ins within that window to see your measured expenditure.
        </p>
      )}

      {state && state !== 'insufficient-data' && (
        <div className="flex flex-col gap-3">
          <div className="rounded-card bg-brand-50 p-4 text-center dark:bg-slate-800">
            <p className="text-caption text-slate-500 dark:text-slate-400">Measured TDEE (7-day)</p>
            <p
              className="text-display tabular-nums text-brand-700 dark:text-brand-400"
              data-testid="expenditure-measured-tdee"
            >
              {Math.round(state.measured.impliedTDEE)} kcal
            </p>
          </div>

          {state.history.length >= 2 && (
            <div className="rounded-card bg-white p-4 shadow-card dark:bg-surface-dark-card" data-testid="expenditure-history-chart">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-caption uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Expenditure, last {state.history.length} weeks
                </span>
                <span
                  className="text-sm font-semibold tabular-nums text-brand-700 dark:text-brand-400"
                  data-testid="expenditure-since-week-1"
                >
                  {Math.round(state.history[state.history.length - 1].impliedTDEE - state.history[0].impliedTDEE) >= 0
                    ? '+'
                    : ''}
                  {Math.round(state.history[state.history.length - 1].impliedTDEE - state.history[0].impliedTDEE)} since
                  week 1
                </span>
              </div>
              <Sparkline points={state.history.map((p) => p.impliedTDEE)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-card bg-white p-3 shadow-card dark:bg-surface-dark-card">
              <p className="text-caption text-slate-500 dark:text-slate-400">Formula estimate</p>
              <p className="font-semibold tabular-nums" data-testid="expenditure-formula-tdee">
                {state.formulaTDEE} kcal
              </p>
            </div>
            <div className="rounded-card bg-white p-3 shadow-card dark:bg-surface-dark-card">
              <p className="text-caption text-slate-500 dark:text-slate-400">Avg logged intake</p>
              <p className="font-semibold tabular-nums" data-testid="expenditure-avg-intake">
                {Math.round(state.measured.meanLoggedKcal)} kcal
              </p>
            </div>
          </div>

          <div className="rounded-card bg-white p-4 shadow-card dark:bg-surface-dark-card">
            <p className="text-caption text-slate-500 dark:text-slate-400">Weight change (7d)</p>
            <p className="font-semibold tabular-nums" data-testid="expenditure-weight-change">
              {state.measured.weeklyWeightChangeKg > 0 ? '+' : ''}
              {state.measured.weeklyWeightChangeKg} kg
            </p>
          </div>

          <p className="text-caption text-slate-500 dark:text-slate-400">
            {Math.abs(state.measured.impliedTDEE - state.formulaTDEE) < 50
              ? 'Your measured expenditure is close to the formula estimate.'
              : state.measured.impliedTDEE > state.formulaTDEE
                ? "You're burning more than the formula predicted - activity or metabolism running a bit hot."
                : "You're burning less than the formula predicted - worth factoring into your target."}
          </p>
        </div>
      )}
    </div>
  )
}
